export type GroupListItem = {
  isGroup: boolean
  name: string
  phone: string
  unread: string
  lastMessageTime: string
  isMuted: string
  isMarkedSpam: string
  archived: string
  pinned: string
  muteEndTime: string | null
  messagesUnread: string
}

export type GroupParticipant = {
  phone: string
  isAdmin: boolean
  isSuperAdmin: boolean
  short?: string
  name?: string
  imgUrl?: string | null
}

export type GroupMetadata = {
  phone: string
  description: string
  owner: string
  subject: string
  creation: number
  invitationLink: string | null
  communityId: string | null
  adminOnlyMessage: boolean
  adminOnlySettings: boolean
  requireAdminApproval: boolean
  isGroupAnnouncement: boolean
  participants: GroupParticipant[]
  subjectTime?: number
  subjectOwner?: string
  photoUrl?: string | null
}
