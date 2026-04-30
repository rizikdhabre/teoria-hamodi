const AUDIO_PROFILE_VERSIONS = {
  he: "google-translate-v2",
};

function normalizeLang(lang) {
  return typeof lang === "string" ? lang.toLowerCase() : "";
}

export function getAudioProfileVersion(lang) {
  return AUDIO_PROFILE_VERSIONS[normalizeLang(lang)] || null;
}

export function hasCurrentAudioProfile(doc, lang) {
  const normalizedLang = normalizeLang(lang);
  const audioEntry = doc?.audio?.[normalizedLang];

  if (!audioEntry) {
    return false;
  }

  const expectedVersion = getAudioProfileVersion(normalizedLang);
  if (!expectedVersion) {
    return true;
  }

  return doc?.audioMeta?.[normalizedLang]?.profileVersion === expectedVersion;
}

export function getCurrentAudioEntry(doc, lang) {
  const normalizedLang = normalizeLang(lang);

  if (!hasCurrentAudioProfile(doc, normalizedLang)) {
    return null;
  }

  return doc?.audio?.[normalizedLang] || null;
}

export function getCurrentAudioMap(doc) {
  if (!doc?.audio || typeof doc.audio !== "object") {
    return null;
  }

  const filteredAudio = Object.fromEntries(
    Object.entries(doc.audio).filter(([lang]) => hasCurrentAudioProfile(doc, lang))
  );

  return Object.keys(filteredAudio).length > 0 ? filteredAudio : null;
}