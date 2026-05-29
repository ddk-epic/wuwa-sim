# Wuthering Waves — Damage Calculation Reference

# Damage Formula Overview

The calculator uses the same formulas as the Wuthering Waves Wiki.

**Main Damage Formula:**

```
Damage = totalAttack × MV × totalDeepen × totalDamageBonus × crit × defenseMultiplier × resistMultiplier
```

Below is the full breakdown of each component.

---

# Component Breakdown

## 1. ATK / HP / DEF Scaling

```
(characterAttack + weaponAttack) × (1 + allAtkPercent) + allFlatAttack
```

Depending on the skill, HP or DEF may replace ATK (scaling stat).

---

## 2. MV — Motion Value

```
(motionValue + additionalMV) × (1 + MVMultipliers)
```

MV represents the inherent multiplier of an attack or skill.

---

## 3. Deepen

```
1 + allDeepen
```

Deepen is a multiplicative category separate from Damage Bonus.

---

## 4. Damage Bonus

```
1 + elementalDmgBonus + attackDmgBonus + skillSpecificDmgBonus + …
```

Includes:

- Elemental DMG Bonus
- Basic/Heavy/Resonance Skill DMG Bonus
- Liberation DMG Bonus
- Echo DMG Bonus
- Other skill‑specific bonuses

---

## 5. Crit

### **No‑crit calculation**

Use:

> 1

### **Crit damage calculation**

Use **totalCritDamage** directly.

> Do **not** add 1 to it.

---

## 6. Defense Multiplier

```
(800 + 8 ⋅ charLevel) /
(800 + 8 ⋅ charLevel + (8 ⋅ enemyLevel + 792) ⋅ (1 − defIgnore) ⋅ (1 − defReduction))
```

This reduces damage based on enemy level and defense.

---

## 7. Resist Multiplier

```
1 − resistance + resistanceReduction
```

**Important rule:**  
If the resulting resistance goes **below 0**, the remaining negative portion is **halved**.

**Example:**

- Final resist = −20%
- Effective resist = −10%

---

# Shields & Healing Formula

Shields and healing use a simpler formula:

```
(MV% × finalAtkDefHpVal + flatBase) × (1 + totalHealBonus)
```

---
