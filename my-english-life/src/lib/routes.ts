/**
 * 画面のURL
 * 項目ごとの画面は ?id= で指定する（画面の HTML が1種類になり、オフラインでもどの項目でも開ける）。
 */
export const routes = {
  words: "/words",
  newWord: "/words/new",
  wordDetail: (id: string) => `/words/detail?id=${encodeURIComponent(id)}`,
  wordEdit: (id: string) => `/words/edit?id=${encodeURIComponent(id)}`,
  dictionary: "/dictionary",
  dictionaryDetail: (word: string) => `/dictionary/detail?w=${encodeURIComponent(word)}`,
  manualReview: (id: string) => `/review?entry=${encodeURIComponent(id)}`,
};
