      /*
       * Modifier: Math ops on number cards.
       * Randomly turns number cards into simple operations.
       */
      function applyNumberChallenge(item) {
        const base = Number(item.label);
        const ops = [
          { label: "Add", sign: "+", fn: (value, n) => value + n },
          { label: "Subtract", sign: "-", fn: (value, n) => value - n },
          { label: "Multiply by", sign: "×", fn: (value, n) => value * n, multiplier: true }
        ];
        let op = ops[Math.floor(Math.random() * ops.length)];
        const delta = op.multiplier ? 2 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3);
        if (op.sign === "-" && base - delta < 0) {
          op = ops[0];
        }
        let recallHint = "";
        if (op.sign === "+") {
          recallHint = `+ ${delta}`;
        } else if (op.sign === "-") {
          recallHint = `- ${delta}`;
        } else {
          recallHint = `* ${delta}`;
        }
        return {
          ...item,
          recallHint,
          answer: String(op.fn(base, delta))
        };
      }

      function applyNumberChallengePlus(item) {
        const base = Number(item.label);
        const ops = [
          { label: "Add", sign: "+", fn: (value, n) => value + n },
          { label: "Subtract", sign: "-", fn: (value, n) => value - n },
          { label: "Multiply by", sign: "×", fn: (value, n) => value * n, multiplier: true }
        ];
        let op = ops[Math.floor(Math.random() * ops.length)];
        const delta = op.multiplier ? 4 + Math.floor(Math.random() * 9) : 12 + Math.floor(Math.random() * 13);
        if (op.sign === "-" && base - delta < 0) {
          op = ops[0];
        }
        let recallHint = "";
        if (op.sign === "+") {
          recallHint = `+ ${delta}`;
        } else if (op.sign === "-") {
          recallHint = `- ${delta}`;
        } else {
          recallHint = `* ${delta}`;
        }
        return {
          ...item,
          recallHint,
          answer: String(op.fn(base, delta))
        };
      }

      function applyNumberChallenges(items, options) {
        if (!options.enableMathOps && !options.enableMathOpsPlus) return items;
        const usePlus = Boolean(options.enableMathOpsPlus);
        const candidates = items
          .map((item, index) => ({ item, index }))
          .filter((entry) => entry.item.category === "numbers");
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const result = items.map((item) => ({ ...item }));
        const min =
          typeof options.mathMinCount === "number" ? Math.max(0, Math.floor(options.mathMinCount)) : null;
        let max =
          typeof options.mathMaxCount === "number" ? Math.max(0, Math.floor(options.mathMaxCount)) : null;
        const defaultMax = 2;
        const limit = max !== null ? max : defaultMax;
        if (min !== null && limit < min) {
          max = min;
        }
        const finalLimit = max !== null ? max : defaultMax;
        const chance =
          typeof options.mathChance === "number" ? Math.max(0, Math.min(1, options.mathChance)) : 0.7;
        const applyFn = usePlus ? applyNumberChallengePlus : applyNumberChallenge;
        let applied = 0;
        const appliedIndices = new Set();
        if (min !== null) {
          for (const entry of candidates) {
            if (applied >= min) break;
            result[entry.index] = applyFn(entry.item);
            applied += 1;
            appliedIndices.add(entry.index);
          }
        }
        for (const entry of candidates) {
          if (applied >= finalLimit) break;
          if (appliedIndices.has(entry.index)) continue;
          if (Math.random() >= chance) continue;
          result[entry.index] = applyFn(entry.item);
          applied += 1;
        }
        return result;
      }
