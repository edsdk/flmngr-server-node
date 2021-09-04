import {Message} from "./action/resp/Message";

export class MessageException extends Error {

    protected m_message: Message;

    constructor(message: Message) {
        super();
        this.m_message = message;
    }

    public getFailMessage(): Message { return this.m_message; }

}
