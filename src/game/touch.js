// On-screen touch controls: a lower-left virtual joystick and a lower-right
// attack button. Shown on coarse-pointer/touch devices (or force with
// ?touch=1). The joystick captures the camera frame at TOUCH START, so
// holding the stick can never feedback-loop with the following camera.

export function createTouchControls({ controller, combat, camera }) {
  const wanted = new URLSearchParams(location.search).has('touch') ||
    matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!wanted) return { enabled: false };

  const joy = document.getElementById('joy');
  const knob = document.getElementById('joyKnob');
  const atk = document.getElementById('attackBtn');
  joy.style.display = 'block';
  atk.style.display = 'block';

  const R = 46; // knob throw in px
  let active = null; // the pointer that owns the stick
  let yawRef = 0;

  function setFromEvent(e) {
    const rect = joy.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy) || 1;
    const throwLen = Math.min(len, R);
    dx = (dx / len) * throwLen; dy = (dy / len) * throwLen;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = throwLen / R;
    if (mag < 0.08) { controller.clearStick(); return; } // dead zone
    // screen-up = away from the camera; screen-right = camera-right (world -x
    // when facing +z — right-handed, hence the -dx)
    const ang = Math.atan2(-dx, -dy) + yawRef;
    controller.setStick(ang, mag);
  }

  joy.addEventListener('pointerdown', (e) => {
    active = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    yawRef = camera.moveYaw(); // frozen for this hold
    setFromEvent(e);
    e.preventDefault();
  });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === active) setFromEvent(e); });
  const end = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    controller.clearStick();
    knob.style.transform = 'translate(0px, 0px)';
  };
  joy.addEventListener('pointerup', end);
  joy.addEventListener('pointercancel', end);

  atk.addEventListener('pointerdown', (e) => { combat.tryAttack(); e.preventDefault(); });

  return { enabled: true };
}
