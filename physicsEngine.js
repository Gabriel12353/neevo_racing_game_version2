const G = 9.80665;

const SURFACE_COEFFICIENTS = {
  "Very Smooth": 0.006,
  "Smooth": 0.010,
  "Regular": 0.018,
  "Bumpy": 0.035
};

function airDensity(temperatureC, pressureKpa) {
  const pPa = pressureKpa * 1000.0;
  const tK = temperatureC + 273.15;
  const R = 287.05;
  return pPa / (R * tK);
}

function co2ThrustAdjusted(baseThrust, temperatureC) {
  const tRef = 293.15;
  const tActual = temperatureC + 273.15;
  return baseThrust * (tActual / tRef);
}

function co2ThrustProfile(t, peakThrust, duration, decayRate = 5.0) {
  if (t <= duration) {
    return peakThrust * Math.exp(-(decayRate / duration) * t);
  }
  return 0.0;
}

function simulateRun(params) {
  const {
    mass_g,
    Cd,
    area_cm2,
    co2_thrust,
    co2_duration,
    wheel_friction,
    wheel_diameter_mm,
    bearing_quality,
    track_length_m,
    surface,
    temperature,
    pressure,
    time_step,
    enable_drag,
    enable_rolling,
    launch_technique
  } = params;

  const propellantMassKg = 0.008;
  const dryMassKg = mass_g / 1000.0 - propellantMassKg;
  const areaM2 = area_cm2 / 10000.0;
  const Crr = SURFACE_COEFFICIENTS[surface] || 0.018;
  const rho = airDensity(temperature, pressure);
  const peakThrust = co2ThrustAdjusted(co2_thrust, temperature);
  const bearingFrictionForce = 0.05 * bearing_quality;
  const wheelFactor = 1.0 + (0.025 - wheel_diameter_mm / 1000) * 2;
  const dt = time_step;
  const maxTime = 30.0;

  let t = 0.0;
  let v = 0.0;
  let x = 0.0;
  let maxDynamicPressure = 0;
  let tMaxQ = 0;

  const data = [];

  while (t < maxTime && x < track_length_m) {
    let F_thrust = 0;
    let propellantFraction = 0;

    if (t <= co2_duration * 1.5) {
      if (launch_technique === "Standard") {
        F_thrust = co2ThrustProfile(t, peakThrust, co2_duration, 5.0);
      } else if (launch_technique === "Quick Release") {
        F_thrust = co2ThrustProfile(t, peakThrust * 1.2, co2_duration * 0.7, 8.0);
      } else {
        F_thrust = co2ThrustProfile(t, peakThrust * 0.9, co2_duration * 1.3, 3.0);
      }
    }

    if (t < co2_duration) {
      propellantFraction = 1.0 - t / co2_duration;
    } else {
      propellantFraction = 0.0;
    }

    const currentMassKg = dryMassKg + propellantMassKg * propellantFraction;

    const q = 0.5 * rho * v ** 2;
    if (q > maxDynamicPressure) {
      maxDynamicPressure = q;
      tMaxQ = t;
    }

    const F_drag = enable_drag ? 15.0 * 0.5 * rho * Cd * areaM2 * v ** 2 : 0.0;
    const F_rolling = enable_rolling
      ? Crr * currentMassKg * G * wheel_friction * wheelFactor
      : 0.0;
    const F_bearing = bearingFrictionForce;

    const F_net = F_thrust - (F_drag + F_rolling + F_bearing);
    const a = F_net / currentMassKg;

    v = v + a * dt;
    if (v < 0) v = 0;

    x = x + v * dt;
    t = t + dt;

    data.push({
      t: Number(t.toFixed(6)),
      x: Number(x.toFixed(4)),
      v: Number(v.toFixed(4)),
      speed_kmh: Number((v * 3.6).toFixed(4)),
      a: Number(a.toFixed(4)),
      mass: Number(currentMassKg.toFixed(4)),
      F_thrust: Number(F_thrust.toFixed(4)),
      F_drag: Number(F_drag.toFixed(6)),
      F_rolling: Number(F_rolling.toFixed(6)),
      F_bearing: Number(F_bearing.toFixed(6)),
      F_net: Number(F_net.toFixed(4))
    });
  }

  const finishTime = data.length > 0 ? data[data.length - 1].t : 0.0;
  const topSpeed = data.length > 0 ? Math.max(...data.map((d) => d.speed_kmh)) : 0.0;
  const avgSpeed =
    data.length > 0
      ? data.reduce((sum, d) => sum + d.speed_kmh, 0) / data.length
      : 0.0;
  const maxAccel = data.length > 0 ? Math.max(...data.map((d) => d.a)) : 0.0;

  return {
    data,
    finish_time: finishTime,
    top_speed: topSpeed,
    avg_speed: avgSpeed,
    max_accel: maxAccel,
    actual_thrust: peakThrust,
    rho,
    events: {
      launch: 0,
      max_q: tMaxQ,
      burnout: co2_duration,
      finish: finishTime
    }
  };
}

module.exports = {
  G,
  SURFACE_COEFFICIENTS,
  airDensity,
  co2ThrustAdjusted,
  simulateRun
};