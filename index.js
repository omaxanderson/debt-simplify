const colors = require('colors');
const peeps = ['coat rack', 'omax', 'white dave', 'pink rachel', 'crawford', 'thomas bahama'];
const transactions = [
  {
    user: 'coat rack',
    amount: 1462.04,
    note: 'airbnb',
  },
  {
    user: 'coat rack',
    amount: 227.34,
    note: 'sustenance',
  },
  {
    user: 'coat rack',
    amount: 24.23,
    note: 'gas',
  },
  {
    user: 'omax',
    amount: 95,
    note: 'liquid courage',
  },
  {
    user: 'white dave',
    amount: 50,
    note: 'ice cream & liquid courage',
  },
  {
    user: 'thomas bahama',
    amount: 46.49,
    note: 'bear',
  },
  {
    user: 'crawford',
    amount: 100,
    note: 'bbq',
  },
  {
    user: 'white dave',
    amount: 20,
    note: 'bbq',
  },
];

const getBiggestSpender = (lineItems) => {
  const map = lineItems.reduce((acc, cur) => {
    if (acc[cur.user]) {
      acc[cur.user] += cur.amount;
    } else {
      acc[cur.user] = cur.amount;
    }
    return acc;
  }, {});
  return Object.entries(map).sort(([_, a], [__, b]) => b - a)[0];
};

// console.log('totalDebt', getTotalDebt(transactions));

function validateSpending(lineItems, ious) {
  const spending = {};
  lineItems.forEach(({ user, amount }) => {
    if (spending[user]) {
      spending[user] += amount;
    } else {
      spending[user] = amount;
    }
  });
  /*
  console.log(spending);
  console.log(ious);
  */
  ious.forEach(({ to, from, amount }) => {
    spending[to] -= amount;
    if (spending[from]) {
      spending[from] += amount;
    } else {
      spending[from] = amount;
    }
  });
  const strip = (number) => parseFloat(number).toPrecision(12);
  const vals = Object.values(spending).map(s => strip(s));
  return vals.every(v => v === vals[0]);
}

function createIOUs(lineItems, nerds, ious) {
  let lineItemsCopy = [...lineItems];
  const [moneybags, amount] = getBiggestSpender(lineItems);
  const amountPerPeep = amount / nerds.length;
  nerds.forEach(nerd => {
    if (nerd !== moneybags) {
      ious.push({ to: moneybags, from: nerd, amount: amountPerPeep});
    }
  });
  lineItemsCopy = lineItemsCopy.filter(l => l.user !== moneybags);
  return lineItemsCopy;
}

function cancelDuplicateIOUs(ious) {
  return ious.reduce((acc, { to, from, amount }) => {
    const idx = acc.findIndex(({ to: rto, from: rfrom }) => rto === from && rfrom === to);
    const r = acc[idx];
    if (r) {
        // if this iou is greater than existing iou
      if (amount > r.amount) {
        acc[idx] = { to, from, amount: amount - r.amount };
      } else {
        acc[idx] = { ...r, amount: r.amount - amount };
      }
    } else {
      acc.push({ to, from, amount });
    }
    return acc;
  }, []);
}

function getDebts(ious) {
  return ious.reduce((map, cur) => {
    const { to, from, amount } = cur;
    if (map[to]) {
      map[to] -= amount;
    } else {
      map[to] = amount * -1;
    }
    if (map[from]) {
      map[from] += amount;
    } else {
      map[from] = amount;
    }
    return map
  }, {});
}

function addIou(ious, iou) {
  // check for an existing iou between them and update
  const idx = ious.findIndex(i => (i.to === iou.to && i.from === iou.from)
    || (iou.from === i.to && iou.to === i.from));
  if (idx > -1) {
    const existing = ious[idx];
    ious[idx].amount = ious[idx].amount += (iou.to === existing.to ? iou.amount : iou.amount * -1);
  } else {
    ious.push(iou);
  }
}

function getCreditors(ious) {
  return Object.entries(getDebts(ious))
      .filter(([_, amount]) => amount < 0)
      .sort((a, b) => a[1] - b[1]);
}

function getDebtors(ious) {
  return Object.entries(getDebts(ious))
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);
}

function simplifyDebts(ious) {
  const debtors = getDebtors(ious).map(([d]) => d);
  const creditors = getCreditors(ious).map(([c]) => c);
  const newIous = [...ious];
  let transactionsEliminated = 0;
  for (let i = 0; i < debtors.length; i++) {
    const debtor = debtors[i];
    // find a debt going to this debtor and redirect to someone they are paying
    let idx = newIous.findIndex((iou) => iou.to === debtor);
    while (idx > 0) {
      const iou = newIous[idx];
      // iou -> party a
      // debtor -> middleman (party b)
      // creditor -> party c
      // create new iou/update existing iou from a -> c for the amount
      // decrease b's b -> c iou by the amount
      const creditor = newIous.find(a => creditors.includes(a.to) && a.from === debtor).to;
      if (!creditor) {
        throw new Error('fuck');
      }
      transactionsEliminated++;
      // redirect a -> c
      addIou(newIous, { to: creditor, from: iou.from, amount: iou.amount });

      // decrease b -> c
      const debtorCreditorIouIdx = newIous.findIndex(a => a.from === debtor && a.to === creditor);
      newIous[debtorCreditorIouIdx].amount -= iou.amount;

      // delete a -> b
      newIous.splice(idx, 1);

      // restart
      idx = newIous.findIndex((iou) => iou.to === debtor);
    }
  }
  console.log(`Removed ${transactionsEliminated} transactions`);
  return newIous;
}

const ious = [];
let transactionsCopy = [...transactions];
while (transactionsCopy.length) {
  transactionsCopy = createIOUs(transactionsCopy, peeps, ious);
}

const cancelled = cancelDuplicateIOUs(ious);

const finalIous = simplifyDebts(cancelled);
const longest = peeps.reduce((acc, cur) => cur.length > acc ? cur.length : acc, 0);
finalIous.forEach(({ to, from, amount }) =>
  console.log(
    `${colors.cyan(from.padEnd(longest, ' '))} owes ${colors.red(to)} $${colors.green(amount.toFixed(2))}`
  )
);

console.log(`Final spending validated: ${validateSpending(transactions, finalIous)}`);
