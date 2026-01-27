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

      function applyNumberChallenges(items, options) {
        if (!options.enableMathOps) return items;
        const candidates = items
          .map((item, index) => ({ item, index }))
          .filter((entry) => entry.item.category === "numbers");
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        const result = items.map((item) => ({ ...item }));
        let applied = 0;
        for (const entry of candidates) {
          if (applied >= 2) break;
          if (Math.random() >= options.mathChance) continue;
          result[entry.index] = applyNumberChallenge(entry.item);
          applied += 1;
        }
        return result;
      }
