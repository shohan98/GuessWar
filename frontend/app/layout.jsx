import "@fontsource/barlow-condensed/latin-700.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";

export const metadata = {
  title: "GuessWar — Number challenges",
  description: "Set a secret number, invite a rival and play for a promise.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
