// dark or light before the first paint: your pick from settings, else the device's
(function () {
  var t;
  try {
    t = localStorage.getItem("jqzz.theme");
  } catch (e) {}
  if (t !== "dark" && t !== "light") {
    t = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.dataset.theme = t;
  // the plain fonts, if you picked them in settings
  try {
    if (localStorage.getItem("jqzz.fonts") === "clean") document.documentElement.dataset.fonts = "clean";
    if (localStorage.getItem("jqzz.effects") === "reduced") document.documentElement.dataset.effects = "reduced";
  } catch (e) {}
})();
