import { ConversationProvider } from "@elevenlabs/react";
import Home from "./pages/Home";

export default function App() {
  return (
    <ConversationProvider>
      <Home />
    </ConversationProvider>
  );
}
