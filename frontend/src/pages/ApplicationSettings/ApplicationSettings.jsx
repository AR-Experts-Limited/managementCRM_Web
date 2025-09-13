import { useState, useEffect } from "react";
import chroma from "chroma-js";

// Exported so themeLoader can use it
export const applyDarkMode = (mode) => {
    const root = document.documentElement;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (mode === "dark" || (mode === "system" && systemPrefersDark)) {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }

    localStorage.setItem("theme", mode);
};

export default function ApplicationSettings() {
    const [selectedColor, setSelectedColor] = useState('');
    const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");

    useEffect(() => {
        const savedColor = localStorage.getItem("primary-color")
            ? localStorage.getItem("primary-color")
            : getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();

        if (savedColor) {
            applyTheme(savedColor);
            setSelectedColor(savedColor);
        }

        applyDarkMode(theme);

        // Listen for system preference changes in "system" mode
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleSystemChange = () => {
            if (localStorage.getItem("theme") === "system") {
                applyDarkMode("system");
            }
        };
        mediaQuery.addEventListener("change", handleSystemChange);
        return () => mediaQuery.removeEventListener("change", handleSystemChange);
    }, []);

    const applyTheme = (baseColor) => {
        localStorage.setItem("primary-color", baseColor);

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

    const handleChangeClick = () => {
        applyTheme(selectedColor);
        window.location.reload();
    };

    const handleResetClick = () => {
        applyTheme(
            getComputedStyle(document.documentElement)
                .getPropertyValue('--default-primary')
                .trim()
        );
        window.location.reload();
    };

    return (
        <div className='w-full h-full flex flex-col p-1.5 md:p-3.5'>
            <h1 className="text-xl font-bold mb-2">Application Settings</h1>
            <div className="bg-white dark:bg-gray-800 h-full p-6 rounded-lg text-black dark:text-white space-y-4 border border-neutral-200 dark:border-neutral-700">
                <h1 className="text-lg font-bold mb-2">Theme Settings</h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Customize the default application theme to align with your brand's identity and visual standards.<br />
                    The theme you select determines the colour schemes followed throughout the application.
                </p>

                <div className="grid grid-cols-2 gap-3">
                    {/* Theme Color */}
                    <div className="flex flex-col gap-3 bg-gray-100 dark:bg-gray-700 border border-neutral-200 dark:border-neutral-600 rounded-lg p-4">
                        <div>
                            <h1 className="text-lg font-bold mb-2">Theme Color</h1>
                            <p>Choose the theme colour.</p>
                        </div>
                        <div>
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => setSelectedColor(e.target.value)}
                                className="w-16 h-10 border-none outline-none cursor-pointer"
                            />
                            <div className='flex gap-3 mt-2'>
                                <button
                                    onClick={handleChangeClick}
                                    className="px-4 py-2 bg-[var(--primary-600)] text-white rounded hover:opacity-90 transition"
                                >
                                    Change
                                </button>
                                <button
                                    onClick={handleResetClick}
                                    className="px-4 py-2 bg-gray-500 text-white rounded hover:opacity-90 transition"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Light/Dark/System Switcher */}
                    <div className="flex flex-col gap-3 bg-gray-100 dark:bg-gray-700 border border-neutral-200 dark:border-neutral-600 rounded-lg p-4">
                        <div>
                            <h1 className="text-lg font-bold mb-2">Theme Mode</h1>
                            <p>Choose light, dark, or system default theme mode.</p>
                        </div>
                        <div className="flex gap-2">
                            {["light", "dark", "system"].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        applyDarkMode(mode);
                                        setTheme(mode);
                                    }}
                                    className={`px-4 py-2 rounded transition ${theme === mode
                                        ? "bg-[var(--primary-600)] text-white"
                                        : "bg-gray-300 dark:bg-gray-600"
                                        }`}
                                >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
