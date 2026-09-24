export const SITE_URL = 'https://miscellary.com';

export const setPath = (slug: string) => `/sets/${slug}`;

/** Cards are addressed by their printed number, which is frozen once the set is published. */
export const cardPath = (slug: string, position: number) => `/sets/${slug}/cards/${position + 1}`;

export const profilePath = (username: string) => `/users/${username}`;
