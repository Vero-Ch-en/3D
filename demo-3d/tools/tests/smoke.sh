# Every chapter: jump there, play 45 s answering everything, note where it got to. Fails on any error.
# PARTNER=1 plays as her.
INITJS="window.SERR=[]; addEventListener('error',e=>SERR.push(String(e.message))); addEventListener('unhandledrejection',e=>SERR.push('rej: '+String(e.reason&&e.reason.stack||e.reason))); const _ce=console.error; console.error=function(){ SERR.push([...arguments].map(String).join(' ').slice(0,300)); return _ce.apply(console,arguments); };"
[ -n "$PARTNER" ] && INITJS="$INITJS $(cat plog.js)"
ARGS=("(async()=>{ document.getElementById('title').classList.add('hide'); await T.run(2); return ['boot', SERR.slice()] })()")
for ch in prologue morning walk evening bedtime night elsewhere lastbirthday act4_home ending_foundme ending_uncertain ending_iknow ending_perfect ending_stay ending_replaced firstsnow; do
  ARGS+=("(async()=>{ const n0=SERR.length; G.jumpTo('$ch'); const r=await T.run(${SEC:-45},[1,2,1,3,1,2,1,1,1,1]); return ['$ch', r.ch, r.busy, r.modal, SERR.slice(n0)] })()")
done
INIT="$INITJS" SW=300 timeout 3000 python3 st.py "${ARGS[@]}" > smoke${PARTNER:+_p}.out 2>&1
grep -E '^>>' smoke${PARTNER:+_p}.out
N=$(grep -cE "^>>" smoke${PARTNER:+_p}.out); [ "$N" -lt 17 ] && echo "INCOMPLETE: $N of 17 steps"; tail -3 smoke${PARTNER:+_p}.out | grep -i error
echo "ERRORS: $(grep -cE 'PAGEERROR|^error:|"rej:' smoke${PARTNER:+_p}.out)"
