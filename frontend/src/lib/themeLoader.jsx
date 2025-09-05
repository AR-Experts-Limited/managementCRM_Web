import chroma from "chroma-js";
// import { applyDarkMode } from "../pages/ApplicationSettings/ApplicationSettings";

const applyThemeFromStorage = () => {
    const baseColor = localStorage.getItem("primary-color")
        ? localStorage.getItem("primary-color")
        : getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    if (!baseColor) return;

    const scale = chroma
        .scale([
            chroma(baseColor).brighten(2),
            baseColor,
            chroma(baseColor).darken(2),
        ])
        .mode("lab")
        .colors(11);

    const root = document.documentElement;
    root.style.setProperty("--primary", baseColor);

    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    steps.forEach((step, i) => {
        root.style.setProperty(`--primary-${step}`, scale[i]);
    });
};

applyThemeFromStorage();
// applyDarkMode(localStorage.getItem("theme") || "light");
// applyDarkMode("light")
