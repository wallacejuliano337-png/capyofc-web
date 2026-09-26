// Contract reserved for a future signed-URL upload service and Storage RLS.
export interface MessageAttachment {
  id: string;
  message_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  kind: "image" | "file" | "gif";
}
