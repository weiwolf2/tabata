/* =========================================================
   Tabata 計時器：素材設定（Day / Night 各一組）
   換檔案時只要改這裡的路徑，或直接用同檔名覆蓋 assets 裡的檔案。
   可以填相對路徑，也可以填完整網址，例如 https://example.com/my.mp4
   找不到檔案時，圓圈中央會自動顯示佔位畫面和原因。
   ========================================================= */
window.TABATA_CONFIG = {
  // 第一次打開時的模式：'day' 或 'night'（之後會記住使用者的選擇）
  defaultMode: 'day',

  // Day：螢光黃
  day: {
    workoutVideo: 'assets/day/workout.mp4',   // 運動時循環播放的影片（直式 mp4，H.264）
    restImage:    'assets/day/rest.jpg'       // 準備與休息時的靜態圖
  },

  // Night：螢光粉
  night: {
    workoutVideo: 'assets/night/workout.mp4',
    restImage:    'assets/night/rest.jpg'
  }
};
