// GET /v1/events — the live event stream (ADR-0010). Last-Event-ID is accepted but not replayed (P0).
import { http, HttpResponse } from "msw";
import { id } from "../ids";
import { currentUser, route, type Ctx } from "./http";

const encoder = new TextEncoder();

export const eventHandlers = (ctx: Ctx, heartbeatMs: number) => [
  http.get(
    "*/v1/events",
    route(ctx, ({ request }, db) => {
      currentUser(db, request);
      // the mock holds one company; the filter still mirrors the server's tenant check
      const company = id.company();
      let stop = () => {};
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let open = true;
          const send = (text: string) => open && controller.enqueue(encoder.encode(text));
          const off = ctx.events.subscribe((e) => {
            if (e.company_id === company)
              send(`id: ${e.event_id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
          });
          const timer = setInterval(() => send(": ping\n\n"), heartbeatMs);
          stop = () => {
            if (!open) return;
            open = false;
            off();
            clearInterval(timer);
          };
          request.signal.addEventListener("abort", () => {
            if (!open) return; // already cancelled — the controller is closed
            stop();
            controller.close();
          });
          send(": connected\n\n"); // flush headers so the client's onOpen fires at once
        },
        cancel: () => stop(),
      });
      return new HttpResponse(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }),
  ),
];
