import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { continuesMessageGroup } from "../src/features/chat/presentation";
import { Avatar } from "../src/components/ui";
import type { Message } from "../src/types";
const message = (overrides: Partial<Message> = {}) => ({author_id: "a", created_at: "2026-09-22T12:00:00Z", reply_to: null, ...overrides}) as Message;
describe("channel message presentation", () => {
 it("groups only consecutive messages within five minutes", () => {
  expect(continuesMessageGroup(undefined, message())).toBe(false);
  expect(continuesMessageGroup(message(), message({created_at:"2026-09-22T12:04:59Z"}))).toBe(true);
  expect(continuesMessageGroup(message(), message({created_at:"2026-09-22T12:05:00Z"}))).toBe(false);
  expect(continuesMessageGroup(message(), message({author_id:"b"}))).toBe(false);
  expect(continuesMessageGroup(message(), message({created_at:"2026-09-22T11:59:00Z"}))).toBe(false);
 });
 it("separates replies and local calendar days without mutating data", () => {
  const original=message(), next=message({reply_to:"reference"}); const snapshot=JSON.stringify([original,next]);
  expect(continuesMessageGroup(original,next)).toBe(false);
  expect(continuesMessageGroup(next,original)).toBe(false);
  expect(continuesMessageGroup(message({created_at:new Date(2026,8,22,23,59).toISOString()}),message({created_at:new Date(2026,8,23,0,1).toISOString()}))).toBe(false);
  expect(JSON.stringify([original,next])).toBe(snapshot);
 });
 it("keeps supplied avatars and initials fallback", () => {
  const image=renderToStaticMarkup(createElement(Avatar,{name:"Coronel",url:"/avatar-fixture.png",size:40}));
  expect(image).toContain('<img src="/avatar-fixture.png"');
  const fallback=renderToStaticMarkup(createElement(Avatar,{name:"Naori",url:null,size:40}));
  expect(fallback).toContain('/assets/avatar-padrao-capychat.png');
 });
});
