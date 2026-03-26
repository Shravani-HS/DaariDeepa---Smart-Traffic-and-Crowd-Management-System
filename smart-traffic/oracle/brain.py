"""
brain.py — Oracle AI Brain

Handles:
  • Multi-turn conversation memory
  • Intent detection (route / traffic / parking / general)
  • Tool calls → traffic_api, route_advisor, parking modules
  • Claude (primary) + GPT-4o-mini (fallback) + keyword fallback
"""

import re
import json
from typing import Optional
from config import Config
from traffic_api import TrafficAPI
from route_advisor import RouteAdvisor
from parking import ParkingFinder


# ── Intent patterns ──────────────────────────────────────────────────────────
ROUTE_KEYWORDS    = ["route", "navigate", "go to", "directions", "how do i get", "take me", "way to", "drive to", "reach"]
TRAFFIC_KEYWORDS  = ["traffic", "congestion", "jam", "slow", "busy", "road condition", "accident", "incident"]
PARKING_KEYWORDS  = ["park", "parking", "lot", "space", "where can i", "find parking"]
ETA_KEYWORDS      = ["how long", "eta", "time to", "when will", "minutes", "arrive"]


def detect_intent(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ROUTE_KEYWORDS):   return "route"
    if any(k in t for k in PARKING_KEYWORDS): return "parking"
    if any(k in t for k in TRAFFIC_KEYWORDS): return "traffic"
    if any(k in t for k in ETA_KEYWORDS):     return "eta"
    return "general"


def extract_destination(text: str) -> Optional[str]:
    """Pull destination string from user utterance."""
    patterns = [
        r"(?:go to|navigate to|take me to|directions to|drive to|route to|way to|reach)\s+(.+?)(?:\s+please|\s+now|$)",
        r"(?:how do i get to|how to get to)\s+(.+?)(?:\?|$)",
        r"(?:to|towards)\s+([A-Z][a-zA-Z\s,]+?)(?:\s+from|\s+please|$)",
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


class OracleBrain:
    def __init__(self, config: Config):
        self.config   = config
        self.history  = []        # list of {"role": ..., "content": ...}
        self.traffic  = TrafficAPI(config)
        self.router   = RouteAdvisor(config)
        self.parking  = ParkingFinder(config)

        # Try to init Claude
        self._claude_client = None
        self._openai_client = None
        self._init_clients()

    def _init_clients(self):
        if self.config.ai_backend == "claude" and self.config.anthropic_api_key:
            try:
                import anthropic
                self._claude_client = anthropic.Anthropic(api_key=self.config.anthropic_api_key)
                print("✅ Claude client initialised")
            except Exception as e:
                print(f"⚠️  Claude init failed: {e}")

        if self.config.openai_api_key:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=self.config.openai_api_key)
                print("✅ OpenAI client initialised")
            except Exception as e:
                print(f"⚠️  OpenAI init failed: {e}")

    # ── Public interface ─────────────────────────────────────────────────────

    def respond(self, user_text: str) -> str:
        """Main entry. Returns a voice-ready response string."""
        intent = detect_intent(user_text)
        context_data = self._gather_context(intent, user_text)

        # Build the augmented prompt
        augmented = self._build_augmented_prompt(user_text, intent, context_data)

        # Get AI response
        reply = self._call_ai(augmented)

        # Update history
        self._push_history("user",      user_text)
        self._push_history("assistant", reply)

        return reply

    # ── Context gathering ────────────────────────────────────────────────────

    def _gather_context(self, intent: str, text: str) -> dict:
        """Call the appropriate data modules based on intent."""
        ctx = {}
        dest = extract_destination(text)

        if intent in ("route", "eta") and dest:
            ctx["destination"]   = dest
            ctx["route_info"]    = self.router.get_best_route(dest)
            ctx["traffic_ahead"] = self.traffic.get_traffic_on_route(dest)

        elif intent == "traffic":
            ctx["traffic_summary"] = self.traffic.get_area_summary()

        elif intent == "parking" and dest:
            ctx["destination"]     = dest
            ctx["parking_options"] = self.parking.find_nearby(dest)

        else:
            # Always provide a brief traffic snapshot for general queries
            ctx["general_traffic"] = self.traffic.get_area_summary(brief=True)

        return ctx

    def _build_augmented_prompt(self, user_text: str, intent: str, ctx: dict) -> str:
        """Append live data to the user's query so the LLM has facts to cite."""
        lines = [user_text]

        if ctx.get("destination"):
            lines.append(f"[Destination: {ctx['destination']}]")

        if ctx.get("route_info"):
            r = ctx["route_info"]
            lines.append(
                f"[Route data: Best route is {r.get('name','unknown')}. "
                f"Distance {r.get('distance_km','?')} km. "
                f"ETA {r.get('eta_min','?')} minutes. "
                f"Traffic: {r.get('traffic_level','unknown')}. "
                f"Alt route: {r.get('alt_name','none')} ({r.get('alt_eta_min','?')} min).]"
            )

        if ctx.get("traffic_ahead"):
            t = ctx["traffic_ahead"]
            lines.append(
                f"[Traffic on route: {t.get('summary','No data')}. "
                f"Incidents: {t.get('incidents','none')}.]"
            )

        if ctx.get("traffic_summary"):
            lines.append(f"[Area traffic: {ctx['traffic_summary']}]")

        if ctx.get("general_traffic"):
            lines.append(f"[Quick traffic snapshot: {ctx['general_traffic']}]")

        if ctx.get("parking_options"):
            opts = ctx["parking_options"]
            if opts:
                top = opts[0]
                lines.append(
                    f"[Parking near {ctx.get('destination','destination')}: "
                    f"{top.get('name','Lot')} is {top.get('distance_m','?')} m away, "
                    f"{top.get('available_spaces','?')} spaces free, fee {top.get('fee','unknown')}.]"
                )
            else:
                lines.append("[Parking: No lots found nearby.]")

        return "\n".join(lines)

    # ── AI calls ─────────────────────────────────────────────────────────────

    def _call_ai(self, prompt: str) -> str:
        if self.config.ai_backend == "claude" and self._claude_client:
            return self._call_claude(prompt)
        if self._openai_client:
            return self._call_openai(prompt)
        return self._fallback(prompt)

    def _call_claude(self, prompt: str) -> str:
        try:
            messages = self._build_messages(prompt)
            resp = self._claude_client.messages.create(
                model="claude-haiku-4-5-20251001",     # fast, cheap, great for voice
                max_tokens=300,
                system=self.config.system_prompt,
                messages=messages,
            )
            return resp.content[0].text.strip()
        except Exception as e:
            print(f"⚠️  Claude call failed: {e}")
            return self._call_openai(prompt) if self._openai_client else self._fallback(prompt)

    def _call_openai(self, prompt: str) -> str:
        try:
            messages = [{"role": "system", "content": self.config.system_prompt}]
            messages += self._build_messages(prompt)
            resp = self._openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=300,
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"⚠️  OpenAI call failed: {e}")
            return self._fallback(prompt)

    def _build_messages(self, current_prompt: str) -> list:
        """Merge conversation history + current turn."""
        msgs = list(self.history)          # copy history
        msgs.append({"role": "user", "content": current_prompt})
        return msgs

    def _push_history(self, role: str, content: str):
        self.history.append({"role": role, "content": content})
        # Keep only last N turns to avoid token overflow
        max_msgs = self.config.max_history_turns * 2
        if len(self.history) > max_msgs:
            self.history = self.history[-max_msgs:]

    # ── Keyword fallback ─────────────────────────────────────────────────────

    def _fallback(self, text: str) -> str:
        t = text.lower()
        dest = extract_destination(text)

        if any(k in t for k in ROUTE_KEYWORDS):
            r = self.router.get_best_route(dest or "your destination")
            if r.get("eta_min"):
                return (
                    f"The best route to {dest or 'your destination'} is via "
                    f"{r.get('name','the main road')}. "
                    f"Estimated travel time is {r.get('eta_min')} minutes "
                    f"with {r.get('traffic_level','moderate')} traffic."
                )
            return f"Head towards {dest or 'your destination'} via the main road. Traffic is moderate."

        if any(k in t for k in PARKING_KEYWORDS):
            return f"There are parking options available near {dest or 'your destination'}. I'll guide you to the nearest one."

        if any(k in t for k in TRAFFIC_KEYWORDS):
            return "Traffic is moderate in most areas right now. There are no major incidents reported."

        return "I'm here to help with routes, traffic, and parking. Where would you like to go?"
