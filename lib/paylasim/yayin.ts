import 'server-only';
import { cloudinaryUrl } from '../format';
import { SITE_URL } from '../site';
import type { SocialPlatform } from '../social-types';
import { feedImageUrl } from '../instagram-utils';
import { isConnected, publishCarousel, publishSinglePost, publishStory } from '../instagram';
import { getFacebookConfig, publishFacebookStory, publishToFacebookPage } from '../facebook-page';
import { publishThreadsMedia, threadsConfigured } from '../threads';
import { channelConfigured, tgChannel } from '../telegram-channel';
import { createPin, listBoards, pinterestConfigured } from '../pinterest';
import { ensureBoard } from '../pinterest-auto';
import { boardNameFor, pinTitle } from '../pinterest-utils';
import { getTikTokState, sendPhotoDraft, tiktokConfigured } from '../tiktok';
import { tiktokPhotoUrls } from '../tiktok-utils';
import { sendTelegramText } from '../notify';
import { clip, productUrl } from '../social-content-utils';
import { hikayeUrl, kisaMetin, telegramMetni, uzunMetin } from './metin';
import type { Paylasim, PaylasimUrun } from './types';

export type YayinSonucu = { atlandi: string } | { remoteId: string };

const cloud = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';
const jpg = (id: string) => cloudinaryUrl(id, 'f_jpg,q_auto,w_1080,c_limit');
const square = (id: string) => cloudinaryUrl(id, 'f_jpg,q_auto,w_1000,h_1000,c_pad,b_white');

export async function yayinla(platform: SocialPlatform, item: Paylasim, u: PaylasimUrun): Promise<YayinSonucu> {
  const story = item.kind === 'hikaye';
  const ids = item.imageIds;
  const storyImage = () => hikayeUrl(cloud(), ids[0], u);

  switch (platform) {
    case 'instagram': {
      if (!(await isConnected())) return { atlandi: 'bağlı değil' };
      if (story) return { remoteId: await publishStory(storyImage()) };
      const urls = ids.map((id) => feedImageUrl(cloud(), id));
      const caption = item.caption || uzunMetin(u, item.color);
      return { remoteId: urls.length === 1 ? await publishSinglePost(urls[0], caption) : await publishCarousel(urls, caption) };
    }
    case 'facebook': {
      if (!getFacebookConfig()) return { atlandi: 'bağlı değil' };
      if (story) return { remoteId: await publishFacebookStory(storyImage()) };
      return { remoteId: await publishToFacebookPage(ids.map(jpg), item.caption || uzunMetin(u, item.color)) };
    }
    case 'threads': {
      if (!threadsConfigured()) return { atlandi: 'bağlı değil' };
      const out = await publishThreadsMedia(ids.map(jpg), (item.caption || kisaMetin(u, item.color, 500)).slice(0, 500));
      return { remoteId: out.id };
    }
    case 'telegram': {
      if (!channelConfigured()) return { atlandi: 'bağlı değil' };
      const caption = telegramMetni(u, item.color);
      const out = ids.length === 1
        ? await tgChannel('sendPhoto', { photo: jpg(ids[0]), caption, parse_mode: 'HTML' })
        : await tgChannel('sendMediaGroup', {
            media: ids.slice(0, 10).map((id, i) => ({ type: 'photo', media: jpg(id), ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}) })),
          });
      if (!out.ok) throw new Error(out.error ?? 'Telegram hatası');
      return { remoteId: String(out.messageId ?? 'albüm') };
    }
    case 'pinterest': {
      if (!(await pinterestConfigured())) return { atlandi: 'bağlı değil' };
      const board = await ensureBoard(await listBoards(), boardNameFor(u.category));
      return {
        remoteId: await createPin({
          boardId: board.id,
          title: pinTitle(u.title),
          description: item.caption ? clip(item.caption, 500) : kisaMetin(u, item.color, 500),
          link: productUrl(u.slug),
          imageUrls: story ? [storyImage()] : ids.slice(0, 5).map(square),
        }),
      };
    }
    case 'tiktok': {
      if (story) {
        const ok = await sendTelegramText(`TikTok hikâyesi hazır: ${u.title}\nGörseli açıp TikTok'ta hikâye olarak paylaşın:\n${storyImage()}`);
        if (!ok) return { atlandi: 'yönetici Telegram bağlı değil' };
        return { remoteId: 'elle' };
      }
      if (!tiktokConfigured() || !(await getTikTokState()).accessToken) return { atlandi: 'bağlı değil' };
      const photoUrls = tiktokPhotoUrls(SITE_URL, ids);
      if (!photoUrls.length) return { atlandi: 'uygun fotoğraf yok' };
      return {
        remoteId: await sendPhotoDraft({
          title: clip(u.title, 90),
          description: item.caption ? clip(item.caption, 2000) : kisaMetin(u, item.color, 2000),
          photoUrls,
        }),
      };
    }
  }
}
