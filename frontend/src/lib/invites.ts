const LOCAL_INVITES_STORAGE_KEY = 'trustcircle_local_invites';

interface LocalInviteMapEntry {
  contractAddress: string;
  circleId: number;
  createdAt: number;
}

type LocalInviteMap = Record<string, LocalInviteMapEntry>;

const normalizeInviteCode = (code: string) => code.trim().toUpperCase();

const loadLocalInvites = (): LocalInviteMap => {
  try {
    const raw = window.localStorage.getItem(LOCAL_INVITES_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as LocalInviteMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveLocalInvites = (invites: LocalInviteMap) => {
  try {
    window.localStorage.setItem(LOCAL_INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch {
    // no-op
  }
};

export const buildLocalInviteCode = (circleAddress: string, circleId: number) => {
  const addressSlice = circleAddress.slice(2, 6).toUpperCase();
  const idSlice = circleId.toString(36).toUpperCase().padStart(2, '0');
  return `TC${addressSlice}${idSlice}`;
};

export const saveLocalInvite = (inviteCode: string, contractAddress: string, circleId: number) => {
  const invites = loadLocalInvites();
  invites[normalizeInviteCode(inviteCode)] = {
    contractAddress: contractAddress.toLowerCase(),
    circleId,
    createdAt: Date.now(),
  };
  saveLocalInvites(invites);
};

export const getLocalInvite = (inviteCode: string) => {
  const invites = loadLocalInvites();
  return invites[normalizeInviteCode(inviteCode)] ?? null;
};
