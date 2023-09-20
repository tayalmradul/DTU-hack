import { Theme } from "./types";

const setTheme = ({ colors, fonts }: Theme) => {
  const r = document.documentElement;

  r.style.setProperty("--color-background", colors.background);
  r.style.setProperty("--color-background-2", colors.background2);
  r.style.setProperty("--color-background-3", colors.background3);
  r.style.setProperty("--color-foreground", colors.foreground);
  r.style.setProperty("--color-foreground-2", colors.foreground2);
  r.style.setProperty("--color-foreground-3", colors.foreground3);
  r.style.setProperty("--color-foreground-4", colors.foreground4);
  r.style.setProperty("--color-foreground-5", colors.foreground5);
  r.style.setProperty("--color-foreground-6", colors.foreground5);
  r.style.setProperty("--color-text-1", colors.text1);
  r.style.setProperty("--color-text-2", colors.text2);
  r.style.setProperty("--color-text-3", colors.text3);
  r.style.setProperty("--color-text-4", colors.text4);

  r.style.setProperty("--font-body", fonts.body);
  r.style.setProperty("--font-heading", fonts.heading);
  r.style.setProperty("--font-alt", fonts.alt);
};

export default setTheme;
