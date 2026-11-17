try {
  const scheme = localStorage.getItem("color-scheme");
  if (scheme === "light" || scheme === "dark") {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", scheme);
  }
  if (localStorage.getItem("stem_contrast") === "high") {
    document.documentElement.dataset.contrast = "high";
  }
  if (localStorage.getItem("stem_reduced_motion") === "1") {
    document.documentElement.dataset.reducedMotion = "true";
  }
} catch {}
