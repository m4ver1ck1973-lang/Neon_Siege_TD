import { Enemy } from './entities';

export class EffectManager {
  applySpecial(target: Enemy, special: string, sourceId:string, damage: number) {
    if (special === 'none' || !target) return;

    const parts = special.split('_');
    const type = parts[0];

    switch (type) {
      case 'slow': {
        // Handles "slow_25" and "slow_45" from "slow_45_vuln_15"
        const value = parseInt(parts[1]) / 100;
        target.addEffect({
          id: crypto.randomUUID(),
          sourceId,
          type: 'slow',
          value,
          duration: 2.0 // Default duration for slows
        });

        // Handle compound effects like "slow_45_vuln_15"
        if (parts.length > 2 && parts[2] === 'vuln') {
          const vulnValue = parseInt(parts[3]) / 100;
          target.addEffect({
            id: crypto.randomUUID(),
            sourceId: sourceId + '_vuln', // unique source
            type: 'vulnerability',
            value: vulnValue,
            duration: 2.0
          });
        }
        break;
      }
      case 'armor': { // "armor_shred"
        target.addEffect({
          id: crypto.randomUUID(),
          sourceId,
          type: 'armor_shred',
          value: 0.1, // Let's define this as 10% increased damage taken per stack
          duration: 4.0
        });
        break;
      }
      case 'corrosion': { // "corrosion_debuff"
        target.addEffect({
          id: crypto.randomUUID(),
          sourceId,
          type: 'corrosion',
          value: 2, // 2 damage per second
          duration: 5.0,
          lastTick: 0 // Initialize for DoT
        });
        break;
      }
      case 'on': { // "on_death_spread"
        if (parts.length === 3 && parts[1] === 'death' && parts[2] === 'spread') {
          target.addEffect({
            id: crypto.randomUUID(),
            sourceId,
            type: 'nanite_plague',
            value: damage, // Damage per second
            duration: 8.0,
            lastTick: 0
          });
        }
        break;
      }
      case 'stun': { // "stun_1s_proc"
        const procChance = 0.25; // 25% chance to proc
        if (parts.length === 3 && parts[2] === 'proc' && Math.random() < procChance) {
          const duration = parseFloat(parts[1].replace('s', ''));
          target.addEffect({
            id: crypto.randomUUID(),
            sourceId,
            type: 'stun',
            value: 1, // Represents full stop
            duration: duration,
          });
        }
        break;
      }
    }
  }
}