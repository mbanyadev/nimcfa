import json, subprocess
m = {x['k']: x['t'] for x in json.load(open('marks.json'))}
INTRO = 14.0
SESSION = m['end'] + 0.8
ARCH, OUTRO = 20.0, 15.0
S = INTRO  # session offset
END_S = S + SESSION
TOTAL = END_S + ARCH + OUTRO
def ts(t):
    h=int(t//3600); mi=int(t%3600//60); s=t%60
    return f"{h}:{mi:02d}:{s:05.2f}"
ev=[]
def add(a,b,style,text): ev.append(f"Dialogue: 0,{ts(a)},{ts(b)},{style},,0,0,0,,{text}")
# Intro
add(0.3,INTRO,'Title',r"{\fad(400,300)}NimCFA")
add(0.8,INTRO,'Sub',r"{\fad(400,300)}NIM ⇄ FCFA on MTN MoMo and Orange Money,\Nright inside Nimiq Pay")
add(3.0,INTRO,'Body',r"{\fad(400,300)}Cash out NIM to mobile money in FCFA, or top up NIM by paying with mobile money. A few taps, in French or English, for Cameroon and the CEMAC zone.")
add(6.0,INTRO,'Small',r"{\fad(400,300)}Nimiq Mini Apps Competition · Cycle III · On/Off-Ramp track · by Mbanya Dev")
# Session captions (left panel)
caps = [
 (0, m['connected'], "Demo",
  "The live mini app from GitHub Pages, on Nimiq testnet. The order engine runs right in your browser. Outside Nimiq Pay a testnet preview wallet stands in; inside Nimiq Pay the same calls go through the mini app SDK."),
 (m['connected'], m['cashout-form'], "Home",
  "Your NIM balance, its value in FCFA at the live rate, and two big actions: cash out or top up."),
 (m['cashout-form'], m['cashout-confirm'], "1 · Cash out",
  "Enter the FCFA you want to receive and a mobile money number. MTN MoMo or Orange Money is detected from the prefix, and the rate is locked for 10 minutes."),
 (m['cashout-confirm'], m['cashout-paid'], "1 · Cash out",
  "One approval sends NIM to the escrow address with the order memo. The engine checks sender, memo, amount and network on-chain, then pays out to mobile money."),
 (m['cashout-paid'], m['refund-form'], "1 · Paid",
  "10,000 FCFA sent to MTN MoMo. Transaction details link every step to the Nimiq testnet explorer."),
 (m['refund-form'], m['refunded'], "2 · Automatic refund",
  "What if the operator rejects the payout? The simulator fails numbers ending in 1 so we can show it: the NIM goes straight back to the sender."),
 (m['refunded'], m['topup-form'], "2 · Refunded",
  "Refunded on-chain, with the reason and a reference. An unknown payout result is held for review instead of retried, so nobody is ever paid twice."),
 (m['topup-form'], m['delivered'], "3 · Top up",
  "Pay FCFA by approving a USSD prompt on your phone. Once the operator confirms, NIM is sent to your Nimiq Pay address."),
 (m['delivered'], m['history'], "3 · NIM delivered",
  "Mobile money in, NIM out, in seconds on testnet."),
 (m['history'], m['french'], "Recent activity",
  "Every order and its status on the home screen, refunds included, so users have a reason to come back."),
 (m['french'], SESSION, "Bilingual",
  "French and English. The app follows the Nimiq Pay host language and network."),
]
for a,b,h,body in caps:
    add(S+a+0.1, S+b, 'CapHead', r"{\fad(250,200)}"+h)
    add(S+a+0.1, S+b, 'Cap', r"{\fad(250,200)}"+body)
add(S, END_S, 'Tag', "TESTNET · MOBILE MONEY SIMULATED · NO REAL FRANCS MOVE")
# Architecture
A = END_S
add(A+0.3, A+ARCH, 'H2', r"{\fad(400,300)}How it works")
add(A+0.8, A+ARCH, 'List', r"{\fad(400,300)}"
    r"• App: Vite + React + @nimiq/mini-app-sdk: accounts, balance, send with memo, host language and network\N"
    r"• Engine: TypeScript order engine (Hono routes, Nimiq JSON-RPC, @nimiq/core signing). This demo runs it in the browser; production runs the same code on Node or Deno\N"
    r"• Price: CoinGecko NIM/EUR × 655.957 (fixed FCFA/EUR peg), 10-minute quotes\N"
    r"• Mobile money: pluggable simulator, Fapshi or CamPay sandbox\N"
    r"• Safety: deposit only from the order's wallet with its memo, automatic refunds, one payout attempt per order, masked phone numbers")
# Outro
O = A + ARCH
add(O+0.3, TOTAL, 'Title', r"{\fad(400,400)}NimCFA")
add(O+0.8, TOTAL, 'Sub', r"{\fad(400,400)}mbanyadev.github.io/nimcfa\Ngithub.com/mbanyadev/nimcfa")
add(O+2.0, TOTAL, 'Body', r"{\fad(400,400)}Next: a real mobile money sandbox, testers in Cameroon, USDT cash-out and a local agent network.")
add(O+3.0, TOTAL, 'Small', r"{\fad(400,400)}MIT licence · Mbanya Dev")

hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Inter,96,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,80,80,150,1
Style: Sub,Inter,40,&H0040C4E9,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,80,80,280,1
Style: Body,Inter,30,&H00E6E6E6,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,8,170,170,410,1
Style: Small,Inter,24,&H00A0A0B0,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,2,80,80,60,1
Style: CapHead,Inter,44,&H0040C4E9,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,70,520,200,1
Style: Cap,Inter,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,70,520,280,1
Style: Tag,Inter,20,&H0060D0F0,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,1,70,520,60,1
Style: H2,Inter,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,80,80,70,1
Style: List,Inter,31,&H00E6E6E6,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,110,110,190,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open('captions.ass','w').write(hdr+"\n".join(ev)+"\n")
fc = (f"color=c=0x1f2348:s=1280x720:r=30:d={TOTAL:.2f}[bg];"
      f"[0:v]scale=-2:660,setpts=PTS-STARTPTS+{S}/TB,format=yuva420p[ph];"
      f"[bg][ph]overlay=x=830:y=30:eof_action=pass:enable='between(t,{S},{END_S})'[v1];"
      f"[v1]ass=captions.ass,format=yuv420p[v]")
cmd = ['ffmpeg','-v','error','-y','-i','raw/session.webm','-f','lavfi','-t',f'{TOTAL:.2f}','-i','anullsrc=r=48000:cl=stereo',
       '-filter_complex',fc,'-map','[v]','-map','1:a','-c:v','libx264','-preset','medium','-crf','20','-r','30',
       '-c:a','aac','-shortest','-movflags','+faststart','/workspace/nimiq-ramp/docs/video/nimcfa-demo.mp4']
print(TOTAL)
subprocess.run(cmd, check=True)
