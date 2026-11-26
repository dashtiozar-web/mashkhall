/** Videos section (acceptance test 12): what a submission stores and how it is shown. */
import { describe, expect, it } from 'vitest';
import { parseTags, subtitlesOf, videoEmbed, videoTags, videoThumbnail, visibleTags, VIDEOS_ONLY_TAG } from '../src/lib/video';

describe('Videos', () => {
  it('accepts only approved video services and plays them on our own pages', () => {
    expect(videoEmbed('https://www.youtube.com/watch?v=aqz-KE-bpKQ')?.src).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
    expect(videoEmbed('https://vimeo.com/76979871')?.provider).toBe('vimeo');
    expect(videoEmbed('https://www.facebook.com/17shubat/videos/123456')?.provider).toBe('facebook');
    expect(videoEmbed('https://example.com/video.mp4')).toBeNull();
    expect(videoEmbed('javascript:alert(1)')).toBeNull();
  });

  it('uses YouTube’s own thumbnail when none is uploaded', () => {
    expect(videoThumbnail('https://youtu.be/ScMzIvxBSi4')).toBe('https://i.ytimg.com/vi/ScMzIvxBSi4/hqdefault.jpg');
    expect(videoThumbnail('https://vimeo.com/1')).toBe('');
  });

  it('stores tags, subtitle languages and where the video appears, without showing the internal ones', () => {
    const tags = videoTags('#protest, Sulaimani; ، press freedom, x, protest', ['ckb', 'ar', 'fr'], true);
    expect(tags).toEqual(['protest', 'Sulaimani', 'press freedom', 'subtitles:ckb', 'subtitles:ar', VIDEOS_ONLY_TAG]);
    expect(visibleTags(tags)).toEqual(['protest', 'Sulaimani', 'press freedom']);
    expect(subtitlesOf(tags)).toEqual(['ckb', 'ar']);
    // People cannot type an internal tag themselves.
    expect(parseTags('videos-only, subtitles:en, real')).toEqual(['real']);
    expect(parseTags('aa,bb,cc,dd,ee,ff,gg,hh,ii,jj').length).toBe(8);
  });
});

describe('Facebook share links', () => {
  it('accepts the links from Facebook’s Share button', async () => {
    const { videoEmbed } = await import('../src/lib/video');
    expect(videoEmbed('https://www.facebook.com/share/v/19pgqkrcdh/')?.provider).toBe('facebook');
    expect(videoEmbed('https://www.facebook.com/share/r/1AbCdEf/')?.vertical).toBe(true);
    expect(videoEmbed('https://www.facebook.com/share/p/1AbCdEf/')).toBeNull();
  });
});
