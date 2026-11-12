/**
 * locales.js
 */

/** Locale namespace of this component's copy. */
export const NS = 'dsh.enhance.notify'

export const zh = {
  soundLabel: '提示音',
  soundHint: '一轮回复结束时播放一段提示音',
  toneLabel: '提示音音色',
  toneHint: '四种音色都是现场合成的，不带任何音频文件',
  'tone.chime': '清脆',
  'tone.bell': '铃声',
  'tone.pulse': '短促',
  'tone.wave': '渐强',
  systemLabel: '系统通知',
  systemHint: '窗口不在前台时，弹出一条 Windows 通知',
  previewLabel: '试听音色',
  previewHint: '先听一遍当前选的音色',
  previewAction: '试听一下',
  notificationTitle: 'DSH 增强',
  notificationBody: '会话「{title}」的回复已完成',
  notificationBodyFallback: '一个会话的回复已完成',
  permissionDenied: '系统通知被浏览器拒绝了，请在这个站点的设置里允许通知',
  permissionUnsupported: '这个环境不支持系统通知',
}

export const en = {
  soundLabel: 'Chime',
  soundHint: 'Play a chime when a reply finishes',
  toneLabel: 'Tone',
  toneHint: 'All four tones are synthesized on the spot — no audio file ships',
  'tone.chime': 'Chime',
  'tone.bell': 'Bell',
  'tone.pulse': 'Pulse',
  'tone.wave': 'Wave',
  systemLabel: 'System notification',
  systemHint: 'Raise a Windows notification while the window is in the background',
  previewLabel: 'Preview tone',
  previewHint: 'Hear the tone you picked',
  previewAction: 'Preview',
  notificationTitle: 'DSH Enhance',
  notificationBody: 'The reply in "{title}" is finished',
  notificationBodyFallback: 'A reply is finished',
  permissionDenied: 'The browser denied notifications; allow them in this site’s settings',
  permissionUnsupported: 'This environment has no system notifications',
}
