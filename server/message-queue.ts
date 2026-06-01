interface UserMessage {
  type: "user";
  message: { role: "user"; content: string };
}

export class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = { type: "user", message: { role: "user", content } };
    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<UserMessage>((r) => { this.waiting = r; });
      }
    }
  }

  close() {
    this.closed = true;
    if (this.waiting) {
      this.waiting({ type: "user", message: { role: "user", content: "__close__" } });
      this.waiting = null;
    }
  }
}
