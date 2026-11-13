/** 初回描画前にテーマを当てて、ちらつきを防ぐ（layout の <head> で使用） */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("mel:theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
