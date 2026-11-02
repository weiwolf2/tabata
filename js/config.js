/* =========================================================
   Tabata 計時器：素材設定
   換檔案時只要改這裡的路徑（或直接用同檔名覆蓋 assets 裡的檔案）。
   可以填相對路徑，也可以填完整網址，例如 https://example.com/my.mp4
   找不到檔案時，圓圈中央會自動顯示佔位畫面。
   ========================================================= */
window.TABATA_CONFIG = {
  // 運動時：圓圈中央循環播放的影片（建議直式 mp4，H.264）
  workoutVideo: 'assets/video/workout.mp4',

  // 準備與休息時：圓圈中央顯示的靜態圖（jpg / png / webp）
  restImage: 'assets/images/rest.jpg'
};
