
export const createChatId = (chatLid: string, phoneNumber: string): string => {
  return `${chatLid}_${phoneNumber}`;
}

export const destructureChatId = (chatId: string): { chatLid: string, phoneNumber: string } => {
  const [chatLid, phoneNumber] = chatId.split("_");
  if (!chatLid || !phoneNumber) {
    throw new Error("Invalid chat ID");
  }
  return { chatLid, phoneNumber };
}