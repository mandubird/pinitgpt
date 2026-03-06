export const metadata = {
  title: "pinitgpt — Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="simple-page">
      <div className="simple-card">
        <h1>Privacy Policy</h1>
        <p>
          This is a lightweight Chrome extension that runs only in your browser on{" "}
          <strong>chatgpt.com</strong>.
        </p>
        <h2>What pinitgpt does</h2>
        <ul>
          <li>Lets you pin specific ChatGPT messages into a sidebar for later reuse.</li>
          <li>Stores your pins locally in your browser (using chrome.storage / localStorage).</li>
          <li>
            Uses Gumroad only for license verification when you choose to activate Pro features.
          </li>
        </ul>
        <h2>What pinitgpt does not do</h2>
        <ul>
          <li>Does not send your ChatGPT conversations to any custom backend owned by pinitgpt.</li>
          <li>Does not collect personal data such as name, email, or payment details.</li>
          <li>Does not track your browsing outside of chatgpt.com.</li>
        </ul>
        <h2>Analytics</h2>
        <p>
          The landing page at <strong>pinitgpt.com</strong> may use Google Analytics (GA4) to
          understand which channels (e.g. Reddit, Product Hunt) send traffic and installs.
        </p>
        <p>
          This is used only to make product decisions (whether to continue building the product) and
          not to track individuals.
        </p>
        <h2>Contact</h2>
        <p>
          If you have any questions about this privacy policy, you can reach the maker via the
          feedback link on the landing page.
        </p>
      </div>
    </main>
  );
}

