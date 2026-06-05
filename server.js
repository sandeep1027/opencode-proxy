import Fastify from "fastify";
import { request } from "undici";
import dotenv from "dotenv";
import { resolveModel, getProvider, ALL_MODELS } from "./models.js";

dotenv.config();

const app = Fastify({ logger: false });

app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
  try {
    done(null, JSON.parse(body));
  } catch (e) {
    done(e);
  }
});

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.OPENCODE_API_KEY?.trim();
const BASE = process.env.OPENCODE_BASE;

function extractText(data) {
  if (data?.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  if (Array.isArray(data?.content)) {
    return data.content
      .filter(x => x.type === "text")
      .map(x => x.text || "")
      .join("");
  }
  if (data?.output_text) {
    return data.output_text;
  }
  return "";
}

function extractToolCalls(data) {
  if (!Array.isArray(data?.content)) return null;
  const toolUseBlocks = data.content.filter(x => x.type === "tool_use");
  if (toolUseBlocks.length === 0) return null;
  return toolUseBlocks.map((block, i) => ({
    id: block.id || `call_${Date.now()}_${i}`,
    type: "function",
    function: {
      name: block.name,
      arguments: JSON.stringify(block.input || {})
    }
  }));
}

function buildResponse(content, model) {
  return {
    id: "chatcmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || "proxy",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: content || "No response generated. Please try again."
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

function buildToolCallResponse(toolCalls, model) {
  return {
    id: "chatcmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || "proxy",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null,
          tool_calls: toolCalls
        },
        finish_reason: "tool_calls"
      }
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

function sendAsStream(reply, content, model) {
  const id = "chatcmpl-" + Date.now();
  const created = Math.floor(Date.now() / 1000);

  const firstChunk = JSON.stringify({
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }]
  });

  const doneChunk = JSON.stringify({
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
  });

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });
  reply.raw.write(`data: ${firstChunk}\n\n`);
  reply.raw.write(`data: ${doneChunk}\n\n`);
  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();
}

function sendToolCallsAsStream(reply, toolCalls, model) {
  const id = "chatcmpl-" + Date.now();
  const created = Math.floor(Date.now() / 1000);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  toolCalls.forEach((tc, i) => {
    const chunk = JSON.stringify({
      id, object: "chat.completion.chunk", created, model,
      choices: [{
        index: 0,
        delta: {
          role: "assistant",
          content: null,
          tool_calls: [{
            index: i,
            id: tc.id,
            type: "function",
            function: { name: tc.function.name, arguments: tc.function.arguments }
          }]
        },
        finish_reason: null
      }]
    });
    reply.raw.write(`data: ${chunk}\n\n`);
  });

  const doneChunk = JSON.stringify({
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }]
  });

  reply.raw.write(`data: ${doneChunk}\n\n`);
  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();
}

function formatMessagesForAnthropic(messages) {
  return (messages || [])
    .filter(m => m.role !== "system")
    .map(msg => {
      if (msg.role === "tool") {
        return {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === "string"
              ? msg.content
              : JSON.stringify(msg.content)
          }]
        };
      }

      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "assistant",
          content: msg.tool_calls.map(tc => ({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: (() => {
              try { return JSON.parse(tc.function.arguments || "{}"); }
              catch { return {}; }
            })()
          }))
        };
      }

      return {
        role: msg.role,
        content: [{
          type: "text",
          text: typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content)
        }]
      };
    });
}

app.get("/health", async () => {
  return { status: "ok" };
});

app.get("/v1/models", async (req, reply) => {
  reply.header("Content-Type", "application/json; charset=utf-8");
  return reply.send({
    object: "list",
    data: ALL_MODELS.map(id => ({
      id,
      object: "model",
      created: 1700000000,
      owned_by: "opencode"
    }))
  });
});

app.post("/v1/chat/completions", async (req, reply) => {
  try {
    const body = req.body || {};
    const model = resolveModel(body.model);
    const provider = getProvider(model);
    const isStream = body.stream === true;

    let url;
    let payload;
    let headers;

    if (provider === "anthropic") {
      url = `${BASE}/messages`;

      const systemMsg = (body.messages || []).find(m => m.role === "system");
      const formattedMessages = formatMessagesForAnthropic(body.messages);

      payload = {
        model,
        ...(systemMsg && { system: systemMsg.content }),
        messages: formattedMessages,
        max_tokens: body.max_tokens || 4096,
        stream: true,
        ...(body.tools && {
          tools: body.tools.map(t => ({
            name: t.function.name,
            description: t.function.description || "",
            input_schema: t.function.parameters || { type: "object", properties: {} }
          }))
        })
      };

      headers = {
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      };

    } else {
      url = `${BASE}/chat/completions`;

      payload = {
        model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        stream: isStream,
        ...(body.max_tokens && { max_tokens: body.max_tokens }),
        ...(body.tools && { tools: body.tools }),
        ...(body.tool_choice && { tool_choice: body.tool_choice })
      };

      headers = {
        "authorization": `Bearer ${API_KEY}`,
        "content-type": "application/json"
      };
    }

    const upstream = await request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    // OpenAI native stream — pipe directly
    if (isStream && provider === "openai") {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      for await (const chunk of upstream.body) {
        reply.raw.write(chunk);
      }
      reply.raw.end();
      return;
    }

    // Anthropic stream — convert to OpenAI SSE format in real time
    if (provider === "anthropic") {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      const id = "chatcmpl-" + Date.now();
      const created = Math.floor(Date.now() / 1000);
      let buffer = "";
      let toolCalls = {};

      for await (const chunk of upstream.body) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          let event;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const outChunk = JSON.stringify({
              id, object: "chat.completion.chunk", created, model,
              choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }]
            });
            reply.raw.write(`data: ${outChunk}\n\n`);
          }

          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            const idx = event.index;
            toolCalls[idx] = {
              id: event.content_block.id,
              name: event.content_block.name,
              arguments: ""
            };
            const outChunk = JSON.stringify({
              id, object: "chat.completion.chunk", created, model,
              choices: [{
                index: 0,
                delta: {
                  role: "assistant",
                  content: null,
                  tool_calls: [{
                    index: idx,
                    id: event.content_block.id,
                    type: "function",
                    function: { name: event.content_block.name, arguments: "" }
                  }]
                },
                finish_reason: null
              }]
            });
            reply.raw.write(`data: ${outChunk}\n\n`);
          }

          if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
            const idx = event.index;
            if (toolCalls[idx]) {
              toolCalls[idx].arguments += event.delta.partial_json;
            }
            const outChunk = JSON.stringify({
              id, object: "chat.completion.chunk", created, model,
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: idx,
                    function: { arguments: event.delta.partial_json }
                  }]
                },
                finish_reason: null
              }]
            });
            reply.raw.write(`data: ${outChunk}\n\n`);
          }

          if (event.type === "message_delta" && event.delta?.stop_reason) {
            const stopReason = event.delta.stop_reason === "tool_use" ? "tool_calls" : "stop";
            const doneChunk = JSON.stringify({
              id, object: "chat.completion.chunk", created, model,
              choices: [{ index: 0, delta: {}, finish_reason: stopReason }]
            });
            reply.raw.write(`data: ${doneChunk}\n\n`);
          }

          if (event.type === "message_stop") {
            reply.raw.write("data: [DONE]\n\n");
          }
        }
      }

      reply.raw.end();
      return;
    }

    // non-stream fallback
    const data = await upstream.body.json();

    if (data?.type === "error" || data?.error) {
      const errMsg = data?.error?.message || JSON.stringify(data);
      console.error("❌ Upstream error:", errMsg);
      if (isStream) { sendAsStream(reply, `Upstream error: ${errMsg}`, model); return; }
      const errResponse = JSON.stringify(buildResponse(`Upstream error: ${errMsg}`, model));
      return reply
        .code(502)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Content-Length", Buffer.byteLength(errResponse))
        .send(errResponse);
    }

    const toolCalls2 = extractToolCalls(data);
    if (toolCalls2) {
      if (isStream) { sendToolCallsAsStream(reply, toolCalls2, model); return; }
      const toolResponse = JSON.stringify(buildToolCallResponse(toolCalls2, model));
      return reply
        .code(200)
        .header("Content-Type", "application/json; charset=utf-8")
        .header("Content-Length", Buffer.byteLength(toolResponse))
        .send(toolResponse);
    }

    const content = extractText(data);
    if (isStream) { sendAsStream(reply, content, model); return; }

    const finalResponse = JSON.stringify(buildResponse(content, model));
    return reply
      .code(200)
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Length", Buffer.byteLength(finalResponse))
      .send(finalResponse);

  } catch (err) {
    console.error("❌ Proxy error:", err);
    if (req.body?.stream) {
      sendAsStream(reply, "Internal proxy error. Check logs.", "proxy");
      return;
    }
    const errResponse = JSON.stringify(buildResponse("Internal proxy error. Check logs.", "proxy"));
    return reply
      .code(500)
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Content-Length", Buffer.byteLength(errResponse))
      .send(errResponse);
  }
});

app.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Proxy running at http://localhost:${PORT}`);
});

