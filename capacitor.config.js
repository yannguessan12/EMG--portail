/* L'APK charge la page hébergée sur GitHub Pages : une modification de la page
   est visible sur tous les téléphones sans réinstaller l'APK.
   APP_URL est fournie automatiquement par le workflow de compilation. */
module.exports = {
  appId: "com.excellencemedical.portail",
  appName: "EMG Portail",
  webDir: "www",
  server: {
    url: process.env.APP_URL || "https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/",
    androidScheme: "https"
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] }
  }
};
