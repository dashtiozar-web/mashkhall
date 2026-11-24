import 'webrtc-adapter';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { of, Observable, Subscription } from 'rxjs';
import { createAudioSink, getCamera, getMic, getScreenshare, PartyTracks, TrackMetadata } from 'partytracks/client';
import {
  Check, Copy, Hand, LogOut, MessageSquare, Mic, MicOff, MonitorUp, MonitorX, Lock, Unlock, Paperclip, PhoneOff,
  Send, Trash2, UserCheck, UserMinus, Users, Video, VideoOff, Volume2, X, MessageSquareOff, MicVocal, Loader2,
} from 'lucide-react';
import { meetingApi } from '../lib/meetings';

/**
 * The live meeting: video grid, microphone, camera, screen sharing,
 * participants, waiting room, raised hands, chat and the leader's controls.
 * Audio and video go through Cloudflare's relay; everything else goes
 * through the meeting room on our server, which decides who is admitted,
 * who may speak and whose tracks are passed on.
 */

interface Track { sessionId: string; trackName: string; location?: string }
interface Person {
  uid: string; name: string; photo: string; role: string; host: boolean; state: 'admitted' | 'waiting';
  canSpeak: boolean; hand: boolean; handAt?: string; mic: boolean; cam: boolean; screen: boolean;
  tracks: Partial<Record<'mic' | 'cam' | 'screen' | 'screenAudio', Track>>;
}
interface ChatMessage { id: number; at: string; uid: string; name: string; kind: 'text' | 'image' | 'file'; text: string; data?: string; fileName?: string }
interface Snapshot {
  meeting: { id: string; title: string; status: string; startedAt?: string; locked: boolean; speaking: 'open' | 'controlled'; media?: 'audio' | 'video'; waitingRoom: string; chatOpen: boolean };
  me: { uid: string; host: boolean; role: string; state: 'admitted' | 'waiting' | 'removed' | 'denied'; canSpeak: boolean } | null;
  people: Person[];
  chat: ChatMessage[];
}

interface Props {
  meetingId: string;
  seat: string;
  title: string;
  canLock: boolean;
  canEnd: boolean;
  canRemove: boolean;
  onLeave: (reason?: 'ended' | 'removed' | 'denied' | 'left') => void;
}

/** People per page: fewer when cameras are on. */
const PAGE_VIDEO = 9;
const PAGE_AUDIO = 24;
const keyOf = (t?: Track) => (t ? `${t.sessionId}/${t.trackName}` : '');
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const elapsed = (from?: string) => {
  if (!from) return '';
  const s = Math.max(0, Math.floor((Date.now() - Date.parse(from)) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
};

const linkify = (text: string) => text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => (/^https?:\/\//.test(part)
  ? <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-[#F2C14E] underline">{part}</a>
  : <React.Fragment key={i}>{part}</React.Fragment>));

/** Shows a remote or local video track. */
const VideoView: React.FC<{ track?: MediaStreamTrack; mirror?: boolean; contain?: boolean; label: string }> = ({ track, mirror, contain, label }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = track ? new MediaStream([track]) : null;
    if (track) el.play().catch(() => undefined);
  }, [track]);
  return <video ref={ref} autoPlay playsInline muted aria-label={label} className={`h-full w-full ${contain ? 'object-contain' : 'object-cover'} ${mirror ? '-scale-x-100' : ''}`} />;
};

/** One person in an audio meeting: photo or initials, with the name underneath. */
const AudioTile: React.FC<{ p: Person; isMe: boolean; micOn: boolean; speaking: boolean }> = ({ p, isMe, micOn, speaking }) => (
  <div className="relative flex flex-col items-center gap-2 rounded-xl bg-[#2A1812] px-2 py-4 ring-1 ring-white/10">
    <span className={`relative rounded-full ${speaking ? 'ring-[3px] ring-[#2FA36B] ring-offset-2 ring-offset-[#2A1812]' : ''}`}>
      {p.photo ? <img src={p.photo} alt="" className="h-16 w-16 rounded-full object-cover" />
        : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#5A3A2C] text-xl font-semibold text-white">{initials(p.name)}</span>}
      <span className={`absolute -bottom-1 -end-1 rounded-full p-1 ${micOn ? 'bg-[#2FA36B]' : 'bg-[#3A2230]'}`}>
        {micOn ? <Mic className="h-3 w-3 text-white" aria-label="Microphone on" /> : <MicOff className="h-3 w-3 text-[#F28B82]" aria-label="Microphone off" />}
      </span>
    </span>
    <span className="w-full truncate text-center text-[0.875rem] text-white"><span data-i18n-skip="" dir="auto">{p.name}</span>{isMe && ' (you)'}</span>
    {p.host && <span className="rounded bg-white/15 px-1.5 text-[0.6875rem] text-white">{p.role === 'leader' ? 'Leader' : 'Host'}</span>}
    {p.hand && <span className="absolute end-2 top-2 rounded-full bg-[#E9A23B] p-1.5 text-[#160C09]" title="Hand raised"><Hand className="h-4 w-4" aria-label="Hand raised" /></span>}
  </div>
);

/** One person in the grid: their camera, or their photo or initials. */
const Tile: React.FC<{ p: Person; small?: boolean; audio?: boolean; isMe: boolean; micOn: boolean; track?: MediaStreamTrack; speaking: boolean }> = ({ p, small, audio, isMe, micOn, track, speaking }) => (audio && !small && !track ? <AudioTile p={p} isMe={isMe} micOn={micOn} speaking={speaking} /> : (
  <div className={`relative overflow-hidden rounded-xl bg-[#2A1812] ${speaking ? 'ring-[3px] ring-[#2FA36B]' : 'ring-1 ring-white/10'} ${small ? 'aspect-video w-40 shrink-0 sm:w-48' : audio ? 'aspect-[4/3]' : 'aspect-video'}`}>
    {track ? <VideoView track={track} mirror={isMe} label={`${p.name}'s camera`} /> : (
      <div className="flex h-full w-full items-center justify-center">
        {p.photo ? <img src={p.photo} alt="" className={`${small ? 'h-12 w-12' : 'h-20 w-20'} rounded-full object-cover`} />
          : <span className={`flex ${small ? 'h-12 w-12 text-base' : 'h-20 w-20 text-2xl'} items-center justify-center rounded-full bg-[#5A3A2C] font-semibold text-white`}>{initials(p.name)}</span>}
      </div>
    )}
    <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/75 to-transparent px-2.5 py-1.5 text-[0.8125rem] text-white">
      {!micOn && <MicOff className="h-3.5 w-3.5 shrink-0 text-[#F28B82]" aria-label="Microphone off" />}
      <span className="truncate" data-i18n-skip="" dir="auto">{p.name}</span>{isMe && <span className="shrink-0">(you)</span>}
      {p.host && <span className="ms-auto shrink-0 rounded bg-white/15 px-1.5 text-[0.6875rem]">{p.role === 'leader' ? 'Leader' : 'Host'}</span>}
    </div>
    {p.hand && <span className="absolute end-2 top-2 rounded-full bg-[#E9A23B] p-1.5 text-[#160C09]" title="Hand raised"><Hand className="h-4 w-4" aria-label="Hand raised" /></span>}
    {speaking && <span className="absolute start-2 top-2 rounded-full bg-[#2FA36B] p-1 text-white" title="Speaking"><Volume2 className="h-3.5 w-3.5" aria-label="Speaking" /></span>}
  </div>
));

/** Measures how loud a track is, to show who is speaking. */
const useSpeaking = () => {
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const ctxRef = useRef<AudioContext | null>(null);
  const analysers = useRef(new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode }>());
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Set<string>();
      const buf = new Uint8Array(256);
      for (const [uid, { analyser }] of analysers.current) {
        analyser.getByteTimeDomainData(buf);
        let peak = 0;
        for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
        if (peak > 12) now.add(uid);
      }
      setSpeaking((prev) => (prev.size === now.size && [...now].every((u) => prev.has(u)) ? prev : now));
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  const watch = useCallback((uid: string, track: MediaStreamTrack | null) => {
    const old = analysers.current.get(uid);
    if (old) { try { old.source.disconnect(); } catch { /* gone */ } analysers.current.delete(uid); }
    if (!track) return;
    try {
      ctxRef.current ||= new AudioContext();
      const source = ctxRef.current.createMediaStreamSource(new MediaStream([track]));
      const analyser = ctxRef.current.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysers.current.set(uid, { analyser, source });
    } catch { /* audio analysis unavailable */ }
  }, []);
  useEffect(() => () => { ctxRef.current?.close().catch(() => undefined); }, []);
  return { speaking, watch };
};

export const MeetingCall: React.FC<Props> = ({ meetingId, seat, title, canLock, canEnd, canRemove, onLeave }) => {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'open' | 'reconnecting'>('connecting');
  const [panel, setPanel] = useState<'people' | 'chat' | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(0);
  const [, tick] = useState(0);
  const [busy, setBusy] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const closedRef = useRef(false);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // ------------------------------------------------------------ media
  const devices = useMemo(() => ({
    mic: getMic({ broadcasting: false, activateSource: false }),
    camera: getCamera({ broadcasting: false, activateSource: false }),
    screen: getScreenshare({ activateSource: false }),
  }), []);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localCam, setLocalCam] = useState<MediaStreamTrack | undefined>();
  const [localScreen, setLocalScreen] = useState<MediaStreamTrack | undefined>();
  const metaRef = useRef<{ mic?: TrackMetadata; cam?: TrackMetadata; screen?: TrackMetadata; screenAudio?: TrackMetadata }>({});
  const flagsRef = useRef({ mic: false, cam: false, screen: false });
  const partyRef = useRef<PartyTracks | null>(null);
  const [videoTracks, setVideoTracks] = useState<Record<string, MediaStreamTrack>>({});
  const pulls = useRef(new Map<string, Subscription>());
  const audioRef = useRef<HTMLAudioElement>(null);
  const sinkRef = useRef<ReturnType<typeof createAudioSink> | null>(null);
  const { speaking, watch } = useSpeaking();

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const sendMedia = useCallback(() => {
    const m = metaRef.current;
    const t = (x?: TrackMetadata) => (x?.sessionId && x.trackName ? { sessionId: x.sessionId, trackName: x.trackName } : null);
    send({ type: 'media', ...flagsRef.current, tracks: { mic: t(m.mic), cam: t(m.cam), screen: t(m.screen), screenAudio: t(m.screenAudio) } });
  }, [send]);

  const admitted = snap?.me?.state === 'admitted';

  // Start sending audio and video once the room has let us in.
  useEffect(() => {
    if (!admitted || partyRef.current) return;
    const party = new PartyTracks({ prefix: `/api/meetings/sfu/${encodeURIComponent(seat)}` });
    partyRef.current = party;
    const subs = new Subscription();
    const push = (name: 'mic' | 'cam' | 'screen' | 'screenAudio', track$: Observable<MediaStreamTrack>, opts?: Parameters<PartyTracks['push']>[1]) => {
      subs.add(party.push(track$, opts).subscribe((meta) => { metaRef.current[name] = meta; sendMedia(); }));
    };
    push('mic', devices.mic.broadcastTrack$);
    push('cam', devices.camera.broadcastTrack$, { sendEncodings$: of([{ maxBitrate: 400_000, maxFramerate: 24 }]) });
    push('screen', devices.screen.video.broadcastTrack$, { sendEncodings$: of([{ maxBitrate: 1_200_000, maxFramerate: 10 }]) });
    push('screenAudio', devices.screen.audio.broadcastTrack$);
    subs.add(devices.camera.broadcastTrack$.subscribe((t) => setLocalCam(t)));
    subs.add(devices.screen.video.broadcastTrack$.subscribe((t) => setLocalScreen(t)));
    subs.add(devices.mic.localMonitorTrack$.subscribe((t) => watch(snap?.me?.uid || 'me', t)));
    // The screen share ends when the person stops it in their browser.
    subs.add(devices.screen.isBroadcasting$.subscribe((on) => {
      setScreenOn(on);
      if (flagsRef.current.screen !== on) { flagsRef.current.screen = on; sendMedia(); }
    }));
    subs.add(devices.mic.error$.subscribe(() => toast('Your microphone could not be used. Check your browser’s permission for this site.')));
    subs.add(devices.camera.error$.subscribe(() => toast('Your camera could not be used. Check your browser’s permission for this site.')));
    subs.add(party.peerConnectionState$.subscribe((s) => { if (s === 'failed') toast('The audio and video connection was interrupted. Reconnecting…'); }));
    if (audioRef.current) sinkRef.current = createAudioSink({ audioElement: audioRef.current });
    return () => {
      subs.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admitted, seat]);

  // Receive the tracks the room passes on: everyone's audio, and video for the people on screen.
  const people = snap?.people || [];
  const me = snap?.me;
  const others = people.filter((p) => p.uid !== me?.uid && p.state === 'admitted');
  const presenter = people.find((p) => p.state === 'admitted' && p.screen && p.tracks.screen);
  const tiles = useMemo(() => {
    const all = people.filter((p) => p.state === 'admitted');
    const sorted = [...all].sort((a, b) => Number(b.uid === me?.uid) - Number(a.uid === me?.uid) || Number(b.host) - Number(a.host) || a.name.localeCompare(b.name));
    return sorted;
  }, [people, me?.uid]);
  const PAGE = snap?.meeting.media === 'video' ? PAGE_VIDEO : PAGE_AUDIO;
  const pages = Math.max(1, Math.ceil(tiles.length / PAGE));
  const visible = tiles.slice(Math.min(page, pages - 1) * PAGE, Math.min(page, pages - 1) * PAGE + PAGE);

  useEffect(() => {
    const party = partyRef.current;
    if (!party || !admitted) return;
    const want = new Map<string, { kind: 'audio' | 'video'; uid: string; track: Track }>();
    for (const p of others) {
      if (p.tracks.mic) want.set(`a:${keyOf(p.tracks.mic)}`, { kind: 'audio', uid: p.uid, track: p.tracks.mic });
      if (p.tracks.screenAudio) want.set(`a:${keyOf(p.tracks.screenAudio)}`, { kind: 'audio', uid: `${p.uid}:screen`, track: p.tracks.screenAudio });
      if (p.tracks.cam && visible.some((v) => v.uid === p.uid)) want.set(`v:${keyOf(p.tracks.cam)}`, { kind: 'video', uid: p.uid, track: p.tracks.cam });
      if (p.tracks.screen && presenter?.uid === p.uid) want.set(`v:${keyOf(p.tracks.screen)}`, { kind: 'video', uid: `${p.uid}:screen`, track: p.tracks.screen });
    }
    for (const [k, sub] of pulls.current) {
      if (!want.has(k)) {
        sub.unsubscribe();
        pulls.current.delete(k);
        if (k.startsWith('v:')) setVideoTracks((v) => { const n = { ...v }; delete n[k.slice(2)]; return n; });
      }
    }
    for (const [k, w] of want) {
      if (pulls.current.has(k)) continue;
      const pulled$ = party.pull(of({ ...w.track, location: 'remote' as const }));
      const sub = new Subscription();
      if (w.kind === 'audio') {
        if (sinkRef.current) sub.add(sinkRef.current.attach(pulled$));
        sub.add(pulled$.subscribe((t) => watch(w.uid, t)));
        sub.add(() => watch(w.uid, null));
      } else {
        sub.add(pulled$.subscribe((t) => setVideoTracks((v) => ({ ...v, [keyOf(w.track)]: t }))));
      }
      pulls.current.set(k, sub);
    }
  }, [others, visible, presenter?.uid, admitted, watch]);

  useEffect(() => () => {
    for (const sub of pulls.current.values()) sub.unsubscribe();
    pulls.current.clear();
    devices.mic.stopBroadcasting();
    devices.camera.stopBroadcasting();
    devices.screen.stopBroadcasting();
    sinkRef.current?.cleanup();
  }, [devices]);

  // ------------------------------------------------------------ room connection
  useEffect(() => {
    closedRef.current = false;
    let attempt = 0;
    let timer = 0;
    let ping = 0;
    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${window.location.host}/api/meetings/ws?seat=${encodeURIComponent(seat)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConnection('open');
        ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), 25000);
        // Tell the room about our tracks again after a reconnection.
        if (partyRef.current) sendMedia();
      };
      ws.onmessage = (ev) => {
        let msg: { type: string } & Record<string, unknown>;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === 'snapshot') setSnap(msg as unknown as Snapshot);
        else if (msg.type === 'chat') {
          const m = msg.message as ChatMessage;
          setSnap((s) => (s ? { ...s, chat: [...s.chat, m].slice(-200) } : s));
          if (panelRef.current !== 'chat') setUnread((n) => n + 1);
        } else if (msg.type === 'chatDeleted') setSnap((s) => (s ? { ...s, chat: s.chat.filter((c) => c.id !== msg.id) } : s));
        else if (msg.type === 'event') {
          const name = String(msg.name || 'Someone');
          if (msg.event === 'joined') toast(`${name} joined the meeting`);
          else if (msg.event === 'left') toast(`${name} left the meeting`);
          else if (msg.event === 'waiting') toast(`${name} is in the waiting room`);
          else if (msg.event === 'hand') toast(`${name} raised their hand`);
        } else if (msg.type === 'notice') toast(String(msg.text || ''));
        else if (msg.type === 'forced') {
          if (msg.what === 'mic') { devices.mic.stopBroadcasting(); setMicOn(false); flagsRef.current.mic = false; }
          if (msg.what === 'screen') { devices.screen.stopBroadcasting(); setScreenOn(false); flagsRef.current.screen = false; }
          if (msg.what === 'cam') { devices.camera.stopBroadcasting(); devices.camera.disableSource(); setCamOn(false); flagsRef.current.cam = false; }
          sendMedia();
          toast(String(msg.text || ''));
        } else if (msg.type === 'ended') { closedRef.current = true; onLeave('ended'); }
        else if (msg.type === 'removed') { closedRef.current = true; onLeave('removed'); }
        else if (msg.type === 'denied') { closedRef.current = true; onLeave('denied'); }
      };
      ws.onclose = (ev) => {
        window.clearInterval(ping);
        if (closedRef.current) return;
        if (ev.code === 4000) { closedRef.current = true; onLeave('ended'); return; }
        if (ev.code === 4003) { closedRef.current = true; onLeave('removed'); return; }
        setConnection('reconnecting');
        attempt += 1;
        if (attempt > 8) { closedRef.current = true; toast('Lost connection to the meeting.'); onLeave('left'); return; }
        timer = window.setTimeout(connect, Math.min(10000, 800 * 2 ** attempt));
      };
    };
    connect();
    return () => {
      closedRef.current = true;
      window.clearTimeout(timer);
      window.clearInterval(ping);
      wsRef.current?.close(1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seat]);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Keep the local state in line when the room takes away permission to speak.
  useEffect(() => {
    if (me && !me.canSpeak && micOn) { devices.mic.stopBroadcasting(); setMicOn(false); flagsRef.current.mic = false; sendMedia(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.canSpeak]);

  // ------------------------------------------------------------ actions
  const toggleMic = () => {
    if (!me?.canSpeak) { toast('In this meeting the leader gives permission to speak. Raise your hand to ask.'); return; }
    const next = !micOn;
    if (next) devices.mic.startBroadcasting(); else devices.mic.stopBroadcasting();
    setMicOn(next);
    flagsRef.current.mic = next;
    sendMedia();
  };
  const toggleCam = () => {
    const next = !camOn;
    if (next && snap?.meeting.media !== 'video') { toast('This is an audio meeting. The leader can allow cameras.'); return; }
    if (next) devices.camera.startBroadcasting(); else { devices.camera.stopBroadcasting(); devices.camera.disableSource(); }
    setCamOn(next);
    flagsRef.current.cam = next;
    sendMedia();
  };
  const toggleScreen = () => {
    if (!me?.canSpeak && !me?.host) { toast('Ask the leader for permission to present.'); return; }
    if (screenOn) { devices.screen.stopBroadcasting(); devices.screen.disableSource(); } else devices.screen.startBroadcasting();
  };
  const myHand = people.find((p) => p.uid === me?.uid)?.hand || false;
  const host = Boolean(me?.host);

  const api = async (label: string, path: string, body: unknown, done?: string) => {
    setBusy(label);
    try { await meetingApi(path, body); if (done) toast(done); } catch (e) { toast((e as Error).message); } finally { setBusy(''); }
  };

  const leave = () => { closedRef.current = true; wsRef.current?.close(1000); onLeave('left'); };
  const endForAll = async () => {
    if (!window.confirm('End the meeting for everyone? You can then confirm attendance.')) return;
    await api('end', 'end', { id: meetingId });
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/meetings/${meetingId}`); toast('Invitation link copied. Only members of this room can use it.'); } catch { toast(`${window.location.origin}/meetings/${meetingId}`); }
  };

  // ------------------------------------------------------------ chat
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { if (panel === 'chat') { setUnread(0); chatEnd.current?.scrollIntoView({ block: 'end' }); } }, [panel, snap?.chat.length]);
  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    send({ type: 'chat', kind: 'text', text: draft.trim() });
    setDraft('');
  };
  const attach = async (file: File) => {
    const image = file.type.startsWith('image/');
    let data = '';
    if (image && file.type !== 'image/gif') {
      // Pictures are made smaller before sending.
      const bmp = await createImageBitmap(file).catch(() => null);
      if (!bmp) { toast('That picture could not be read.'); return; }
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      data = canvas.toDataURL('image/jpeg', 0.8);
    } else {
      if (file.size > 650_000) { toast('Files up to 650 KB can be shared in the chat. For larger files, share a link.'); return; }
      data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
    }
    if (data.length > 880_000) { toast('That file is too large to share in the chat.'); return; }
    send({ type: 'chat', kind: image ? 'image' : 'file', text: draft.trim(), data, fileName: file.name });
    setDraft('');
  };

  // ------------------------------------------------------------ view
  if (!snap) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#160C09] text-white">
        <p className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Connecting to the meeting…</p>
      </div>
    );
  }

  if (me?.state === 'waiting') {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-[#160C09] px-6 text-center text-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#F2C14E]" aria-hidden="true" />
        <h2 className="text-[1.5rem] font-semibold text-white" dir="auto">{title}</h2>
        <p className="max-w-[46ch] text-white/80">You are in the waiting room. The meeting leader will let you in shortly.</p>
        <button type="button" onClick={leave} className="cursor-pointer rounded-lg border border-white/30 px-4 py-2 font-semibold hover:bg-white/10">Leave</button>
      </div>
    );
  }

  const waiting = people.filter((p) => p.state === 'waiting');
  const videoMeeting = snap.meeting.media === 'video';
  const hands = tiles.filter((p) => p.hand).sort((a, b) => String(a.handAt).localeCompare(String(b.handAt)));
  const tileTrack = (p: Person) => !videoMeeting ? undefined : (p.uid === me?.uid ? (camOn ? localCam : undefined) : p.tracks.cam ? videoTracks[keyOf(p.tracks.cam)] : undefined);
  const screenTrack = presenter ? (presenter.uid === me?.uid ? localScreen : videoTracks[keyOf(presenter.tracks.screen)]) : undefined;
  const ctrl = 'flex cursor-pointer flex-col items-center gap-1 rounded-xl px-3 py-2 text-[0.75rem] font-semibold text-white/90 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4';
  const round = (on: boolean, danger = false) => `flex h-11 w-11 items-center justify-center rounded-full ${danger ? 'bg-[#B3261E]' : on ? 'bg-white/15' : 'bg-[#B3261E]/90'}`;

  const tile = (p: Person, small = false) => {
    const isMe = p.uid === me?.uid;
    const on = isMe ? micOn : p.mic;
    return <Tile key={p.uid} p={p} small={small} audio={!videoMeeting} isMe={isMe} micOn={on} track={tileTrack(p)} speaking={on && speaking.has(isMe ? (me?.uid || 'me') : p.uid)} />;
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#160C09] text-white">
      <audio ref={audioRef} autoPlay />
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[1.0625rem] font-semibold text-white" dir="auto" data-i18n-skip="">{snap.meeting.title || title}</h2>
          <p className="flex flex-wrap items-center gap-x-3 text-[0.8125rem] text-white/70">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#E5484D]" aria-hidden="true" /> Live</span>
            <span className="flex items-center gap-1">{videoMeeting ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}{videoMeeting ? 'Audio and video' : 'Audio meeting'}</span>
            <span className="tabular-nums" aria-label="Meeting time">{elapsed(snap.meeting.startedAt)}</span>
            <span>{tiles.length} {tiles.length === 1 ? 'participant' : 'participants'}</span>
            {snap.meeting.locked && <span className="flex items-center gap-1 text-[#F2C14E]"><Lock className="h-3.5 w-3.5" aria-hidden="true" /> Locked</span>}
            {connection !== 'open' && <span className="text-[#F2C14E]">Reconnecting…</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {host && <button type="button" onClick={copyLink} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[0.875rem] hover:bg-white/10"><Copy className="h-4 w-4" aria-hidden="true" /> Invitation link</button>}
          {host && canLock && (
            <button type="button" disabled={busy === 'lock'} onClick={() => api('lock', 'lock', { id: meetingId, locked: !snap.meeting.locked }, snap.meeting.locked ? 'Meeting unlocked.' : 'Meeting locked: no one else can join.')}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[0.875rem] hover:bg-white/10 disabled:opacity-50">
              {snap.meeting.locked ? <Unlock className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} {snap.meeting.locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          {host && (
            <button type="button" onClick={() => send({ type: 'callType', media: videoMeeting ? 'audio' : 'video' })}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-[0.875rem] hover:bg-white/10">
              {videoMeeting ? <VideoOff className="h-4 w-4" aria-hidden="true" /> : <Video className="h-4 w-4" aria-hidden="true" />} {videoMeeting ? 'Audio only' : 'Allow cameras'}
            </button>
          )}
          {host && canEnd && <button type="button" disabled={busy === 'end'} onClick={endForAll} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#B3261E] px-3 py-1.5 text-[0.875rem] font-semibold hover:brightness-110 disabled:opacity-50"><PhoneOff className="h-4 w-4" aria-hidden="true" /> End for all</button>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <main className="flex min-w-0 flex-1 flex-col gap-3 p-3">
          {presenter ? (
            <>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black">
                <VideoView track={screenTrack} contain label={`${presenter.name}'s screen`} />
                <span className="absolute start-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[0.8125rem]">{presenter.uid === me?.uid ? 'You are presenting' : `${presenter.name} is presenting`}</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">{visible.map((p) => tile(p, true))}</div>
            </>
          ) : (
            <div className={`grid min-h-0 flex-1 content-center gap-3 overflow-y-auto ${!videoMeeting ? (visible.length <= 2 ? 'grid-cols-2 sm:mx-auto sm:w-[min(100%,640px)]' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6') : visible.length <= 1 ? 'grid-cols-1 sm:mx-auto sm:w-[min(100%,960px)]' : visible.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 lg:grid-cols-3'}`}>
              {visible.map((p) => tile(p))}
            </div>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 text-[0.875rem]">
              <button type="button" disabled={page === 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="cursor-pointer rounded-md border border-white/20 px-3 py-1 disabled:opacity-40">Previous</button>
              <span className="tabular-nums">{Math.min(page, pages - 1) + 1} / {pages}</span>
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage((n) => Math.min(pages - 1, n + 1))} className="cursor-pointer rounded-md border border-white/20 px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          )}
        </main>

        {/* Side panel */}
        {panel && (
          <aside className="fixed inset-0 z-[85] flex flex-col bg-[#1C120E] sm:static sm:z-auto sm:w-[360px] sm:border-s sm:border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="font-semibold text-white">{panel === 'chat' ? 'Meeting chat' : `People (${tiles.length})`}</h3>
              <button type="button" onClick={() => setPanel(null)} className="cursor-pointer rounded-md p-1 hover:bg-white/10" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            {panel === 'people' && (
              <div className="flex-1 space-y-5 overflow-y-auto p-4 text-[0.9375rem]">
                {host && waiting.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-sans font-semibold text-[#F2C14E]">Waiting room ({waiting.length})</h4>
                      <button type="button" onClick={() => send({ type: 'admitAll' })} className="cursor-pointer text-[0.8125rem] underline">Admit everyone</button>
                    </div>
                    <ul className="space-y-2">{waiting.map((p) => (
                      <li key={p.uid} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate" data-i18n-skip="" dir="auto">{p.name}</span>
                        <button type="button" onClick={() => send({ type: 'admit', uid: p.uid })} className="flex cursor-pointer items-center gap-1 rounded-md bg-[#2FA36B] px-2 py-1 text-[0.8125rem] font-semibold"><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Admit</button>
                        <button type="button" onClick={() => send({ type: 'deny', uid: p.uid })} className="cursor-pointer rounded-md border border-white/20 px-2 py-1 text-[0.8125rem]">Decline</button>
                      </li>
                    ))}</ul>
                  </section>
                )}
                {hands.length > 0 && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="font-sans font-semibold text-[#F2C14E]">Raised hands ({hands.length})</h4>
                      {host && <button type="button" onClick={() => send({ type: 'lowerHands' })} className="cursor-pointer text-[0.8125rem] underline">Lower all</button>}
                    </div>
                    <ol className="list-decimal space-y-1 ps-5">{hands.map((p) => <li key={p.uid} data-i18n-skip="" dir="auto">{p.name}</li>)}</ol>
                  </section>
                )}
                {host && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => send({ type: 'muteAll' })} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-[0.8125rem]"><MicOff className="h-3.5 w-3.5" aria-hidden="true" /> Mute everyone</button>
                    <button type="button" onClick={() => send({ type: 'chatOpen', open: !snap.meeting.chatOpen })} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-[0.8125rem]">
                      {snap.meeting.chatOpen ? <MessageSquareOff className="h-3.5 w-3.5" aria-hidden="true" /> : <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />} {snap.meeting.chatOpen ? 'Pause chat' : 'Open chat'}
                    </button>
                  </div>
                )}
                <section>
                  <h4 className="mb-2 font-sans font-semibold text-white">In the meeting</h4>
                  <ul className="space-y-2.5">{tiles.map((p) => (
                    <li key={p.uid} className="flex flex-wrap items-center gap-2">
                      {p.photo ? <img src={p.photo} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5A3A2C] text-[0.75rem] font-semibold">{initials(p.name)}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate"><span data-i18n-skip="" dir="auto">{p.name}</span>{p.uid === me?.uid ? ' (you)' : ''}</span>
                        <span className="text-[0.75rem] text-white/60">{p.host ? (p.role === 'leader' ? 'Meeting leader' : p.role === 'senior' ? 'Senior official' : 'Administrator') : snap.meeting.speaking === 'controlled' ? (p.canSpeak ? 'May speak' : 'Listening') : 'Member'}</span>
                      </span>
                      {p.hand && <Hand className="h-4 w-4 text-[#E9A23B]" aria-label="Hand raised" />}
                      {(p.uid === me?.uid ? micOn : p.mic) ? <Mic className="h-4 w-4" aria-label="Microphone on" /> : <MicOff className="h-4 w-4 text-white/50" aria-label="Microphone off" />}
                      {host && !p.host && p.uid !== me?.uid && (
                        <span className="flex w-full flex-wrap gap-1.5 ps-10">
                          {p.mic && <button type="button" onClick={() => send({ type: 'mute', uid: p.uid })} className="cursor-pointer rounded border border-white/20 px-2 py-0.5 text-[0.75rem]">Mute</button>}
                          {snap.meeting.speaking === 'controlled' && (
                            <button type="button" onClick={() => send({ type: 'speak', uid: p.uid, allow: !p.canSpeak })} className="flex cursor-pointer items-center gap-1 rounded border border-white/20 px-2 py-0.5 text-[0.75rem]"><MicVocal className="h-3 w-3" aria-hidden="true" /> {p.canSpeak ? 'End turn' : 'Allow to speak'}</button>
                          )}
                          {p.screen && <button type="button" onClick={() => send({ type: 'stopScreen', uid: p.uid })} className="cursor-pointer rounded border border-white/20 px-2 py-0.5 text-[0.75rem]">Stop sharing</button>}
                          {canRemove && (
                            <button type="button" onClick={() => { if (window.confirm(`Remove ${p.name} from this meeting? They will not be able to rejoin it.`)) api('remove', 'remove', { id: meetingId, uid: p.uid }, `${p.name} was removed.`); }}
                              className="flex cursor-pointer items-center gap-1 rounded border border-[#E5484D]/60 px-2 py-0.5 text-[0.75rem] text-[#F28B82]"><UserMinus className="h-3 w-3" aria-hidden="true" /> Remove</button>
                          )}
                        </span>
                      )}
                    </li>
                  ))}</ul>
                </section>
              </div>
            )}

            {panel === 'chat' && (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                  {snap.chat.length === 0 && <p className="text-[0.875rem] text-white/60">Messages are seen only by people in this meeting and are deleted when it ends.</p>}
                  {snap.chat.map((c) => (
                    <div key={c.id} className="group text-[0.9375rem]">
                      <p className="text-[0.75rem] text-white/60">
                        <span className="font-semibold text-white/85" data-i18n-skip="" dir="auto">{c.name}</span> · {new Date(c.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {host && <button type="button" onClick={() => send({ type: 'deleteChat', id: c.id })} className="ms-2 cursor-pointer opacity-60 hover:opacity-100" aria-label="Delete message"><Trash2 className="inline h-3 w-3" /></button>}
                      </p>
                      {c.text && <p className="whitespace-pre-wrap break-words" dir="auto" data-i18n-skip="">{linkify(c.text)}</p>}
                      {c.kind === 'image' && c.data && <a href={c.data} download={c.fileName || 'image.jpg'}><img src={c.data} alt={c.fileName || 'Shared picture'} className="mt-1 max-h-56 rounded-md" /></a>}
                      {c.kind === 'file' && c.data && <a href={c.data} download={c.fileName || 'file'} className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[0.8125rem] underline"><Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> {c.fileName || 'Download file'}</a>}
                    </div>
                  ))}
                  <div ref={chatEnd} />
                </div>
                {snap.meeting.chatOpen || host ? (
                  <form onSubmit={sendChat} className="flex items-end gap-2 border-t border-white/10 p-3">
                    <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) attach(f); e.target.value = ''; }} />
                    <button type="button" onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-md p-2 hover:bg-white/10" aria-label="Share a picture or file"><Paperclip className="h-5 w-5" /></button>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(e); } }}
                      rows={1} maxLength={2000} dir="auto" placeholder="Write a message or paste a link" aria-label="Message"
                      className="max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-white/15 bg-[#160C09] px-3 py-2 text-[0.9375rem] text-white placeholder:text-white/40" />
                    <button type="submit" className="cursor-pointer rounded-md bg-[#B3261E] p-2" aria-label="Send"><Send className="h-5 w-5" /></button>
                  </form>
                ) : <p className="border-t border-white/10 p-3 text-[0.875rem] text-white/60">The leader has paused the chat.</p>}
              </>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="flex flex-wrap items-center justify-center gap-1 border-t border-white/10 px-2 py-2 sm:gap-2">
        <button type="button" onClick={toggleMic} className={ctrl} aria-pressed={micOn}>
          <span className={round(micOn)}>{micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</span>{micOn ? 'Mute' : me?.canSpeak ? 'Unmute' : 'Muted'}
        </button>
        {(videoMeeting || camOn) && (
          <button type="button" onClick={toggleCam} className={ctrl} aria-pressed={camOn}>
            <span className={round(camOn)}>{camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</span>{camOn ? 'Stop video' : 'Start video'}
          </button>
        )}
        {typeof navigator !== 'undefined' && 'getDisplayMedia' in (navigator.mediaDevices || {}) && (
          <button type="button" onClick={toggleScreen} className={ctrl} aria-pressed={screenOn}>
            <span className={round(true)}>{screenOn ? <MonitorX className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}</span>{screenOn ? 'Stop sharing' : 'Share screen'}
          </button>
        )}
        <button type="button" onClick={() => send({ type: 'hand', raised: !myHand })} className={ctrl} aria-pressed={myHand}>
          <span className={`${round(true)} ${myHand ? '!bg-[#E9A23B] text-[#160C09]' : ''}`}><Hand className="h-5 w-5" /></span>{myHand ? 'Lower hand' : 'Raise hand'}
        </button>
        <button type="button" onClick={() => setPanel(panel === 'people' ? null : 'people')} className={ctrl} aria-pressed={panel === 'people'}>
          <span className={`relative ${round(true)}`}><Users className="h-5 w-5" />{host && waiting.length > 0 && <span className="absolute -end-1 -top-1 rounded-full bg-[#E9A23B] px-1.5 text-[0.6875rem] font-bold text-[#160C09]">{waiting.length}</span>}</span>People
        </button>
        <button type="button" onClick={() => setPanel(panel === 'chat' ? null : 'chat')} className={ctrl} aria-pressed={panel === 'chat'}>
          <span className={`relative ${round(true)}`}><MessageSquare className="h-5 w-5" />{unread > 0 && <span className="absolute -end-1 -top-1 rounded-full bg-[#E5484D] px-1.5 text-[0.6875rem] font-bold">{unread}</span>}</span>Chat
        </button>
        <button type="button" onClick={leave} className={ctrl}>
          <span className={round(false, true)}><LogOut className="h-5 w-5" /></span>Leave
        </button>
      </footer>

      {/* Join, leave and other notices */}
      <div className="pointer-events-none fixed bottom-24 start-1/2 z-[90] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 rtl:translate-x-1/2" aria-live="polite">
        {toasts.map((t) => <p key={t.id} className="flex items-center gap-2 rounded-lg bg-black/85 px-3 py-2 text-[0.875rem] shadow-lg"><Check className="h-4 w-4 shrink-0 text-[#2FA36B]" aria-hidden="true" />{t.text}</p>)}
      </div>
    </div>
  );
};

export default MeetingCall;
