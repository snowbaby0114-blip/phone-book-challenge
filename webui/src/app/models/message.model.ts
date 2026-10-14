export const MESSAGE_TYPES = ['SMS', 'Email'] as const;
export const MESSAGE_STATUSES = ['Queued', 'Sent', 'Failed', 'Delivered', 'Read'] as const;
export const MESSAGE_BODY_MAX_LENGTH = 1000;

export type MessageType = (typeof MESSAGE_TYPES)[number];
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export type MessageSortField = 'date' | 'contact' | 'type' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface Message {
  id: number;
  type: MessageType;
  status: MessageStatus;
  body: string;
  date: string;
  contactId: number;
  contactName: string;
  contactPhoneNumber: string;
  contactEmail: string;
}

export interface NewMessage {
  contactId: number;
  type: MessageType;
  body: string;
}

export interface MessageQuery {
  page: number;
  pageSize: number;
  sortBy: MessageSortField;
  sortDirection: SortDirection;
  type?: MessageType | null;
  status?: MessageStatus | null;
  contactId?: number | null;
  search?: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
