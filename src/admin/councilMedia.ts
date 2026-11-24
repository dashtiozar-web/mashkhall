/** A link the browser can play as a silent background video. */
export const isVideoFile = (url: string) => /^https:\/\/[^\s]+\.(mp4|webm|m4v)(\?[^\s]*)?$/i.test(url.trim());
