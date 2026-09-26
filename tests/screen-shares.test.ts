import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  tracks: [] as {
    participant: { identity: string; name: string };
    publication: { trackSid: string };
  }[],
}));
vi.mock("@livekit/components-react", () => ({
  useTracks: vi.fn(() => state.tracks),
  VideoTrack: ({
    trackRef,
    ...props
  }: {
    trackRef: { publication: { trackSid: string } };
  }) =>
    createElement("video", {
      ...props,
      "data-track": trackRef.publication.trackSid,
    }),
}));
import { ScreenShares } from "../src/features/voice/ScreenShares";
import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
const stream = (id: string) => ({
  participant: { identity: id, name: id },
  publication: { trackSid: "screen-" + id },
});
const render = () => renderToStaticMarkup(createElement(ScreenShares));
beforeEach(() => {
  state.tracks = [];
  vi.clearAllMocks();
});
it("automatically renders an already subscribed screen share without a watch button", () => {
  state.tracks = [stream("Coronel")];
  const html = render();
  expect(html).toContain("<video");
  expect(html).toContain('data-track="screen-Coronel"');
  expect(html).toContain('muted=""');
  expect(html).toContain('autoPlay=""');
  expect(html).not.toContain("<audio");
  expect(html).not.toContain("Assistir transmissão");
  expect(html).toContain("Ampliar transmissão de Coronel");
  expect(html).toContain("Tela cheia");
  expect(useTracks).toHaveBeenCalledWith([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });
});
it("follows publication arrival, removal, and restart without requiring a selected participant", () => {
  expect(render()).toBe("");
  state.tracks = [stream("A")];
  expect(render()).toContain("<video");
  state.tracks = [];
  expect(render()).toBe("");
  state.tracks = [stream("A")];
  expect(render()).toContain("<video");
});
it("renders multiple independent publications without introducing audio renderers", () => {
  state.tracks = [stream("A"), stream("B")];
  const html = render();
  expect(html.match(/<video/g)).toHaveLength(2);
  expect(html.match(/muted=""/g)).toHaveLength(2);
  expect(html).not.toContain("<audio");
});
