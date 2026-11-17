/* Хуудас зурагдахаас өмнө өнгөний горимыг тохируулна (цайвар / бараан / систем).
   CSP inline script зөвшөөрдөггүй тул тусдаа файлд байна. */
(function applySavedTheme() {
  try {
    var theme = localStorage.getItem('odb-theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch (e) { /* localStorage хаалттай бол системийн горим */ }
}());
