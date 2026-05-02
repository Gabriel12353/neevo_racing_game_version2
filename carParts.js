const CAR_PARTS = {
  front: [
    {
      id: 1,
      name: "front wing 1",
      mass: 9,
      cd: 0.135,
      image: "/assets/parts/front/front1.png"
    },
    {
      id: 2,
      name: "front wing 2",
      mass: 12,
      cd: 0.104,
      image: "/assets/parts/front/front2.png"
    },
    {
      id: 3,
      name: "front wing 3",
      mass: 15,
      cd: 0.116,
      image: "/assets/parts/front/front3.png"
    },
    {
      id: 4,
      name: "front wing 4",
      mass: 17,
      cd: 0.091,
      image: "/assets/parts/front/front4.png"
    }
  ],

  body: [
    {
      id: 1,
      name: "body 1",
      mass: 17,
      cd: 0.176,
      image: "/assets/parts/body/body1.png"
    },
    {
      id: 2,
      name: "body 2",
      mass: 21,
      cd: 0.141,
      image: "/assets/parts/body/body2.png"
    },
    {
      id: 3,
      name: "body 3",
      mass: 23,
      cd: 0.153,
      image: "/assets/parts/body/body3.png"
    },
    {
      id: 4,
      name: "body 4",
      mass: 26,
      cd: 0.118,
      image: "/assets/parts/body/body4.png"
    }
  ],

  rear: [
    {
      id: 1,
      name: "rear wing 1",
      mass: 24,
      cd: 0.128,
      image: "/assets/parts/rear/rear1.png"
    },
    {
      id: 2,
      name: "rear wing 2",
      mass: 26,
      cd: 0.101,
      image: "/assets/parts/rear/rear2.png"
    },
    {
      id: 3,
      name: "rear wing 3",
      mass: 28,
      cd: 0.113,
      image: "/assets/parts/rear/rear3.png"
    },
    {
      id: 4,
      name: "rear wing 4",
      mass: 30,
      cd: 0.086,
      image: "/assets/parts/rear/rear4.png"
    }
  ]
};

function buildSelection(selection) {
  const frontIndex = Number(selection.frontIndex ?? 0);
  const bodyIndex = Number(selection.bodyIndex ?? 0);
  const rearIndex = Number(selection.rearIndex ?? 0);

  const front = CAR_PARTS.front[frontIndex];
  const body = CAR_PARTS.body[bodyIndex];
  const rear = CAR_PARTS.rear[rearIndex];

  const totalMass = front.mass + body.mass + rear.mass;
  const totalCd = Number((front.cd + body.cd + rear.cd).toFixed(3));

  return {
    frontIndex,
    bodyIndex,
    rearIndex,
    front,
    body,
    rear,
    totalMass,
    totalCd
  };
}

module.exports = {
  CAR_PARTS,
  buildSelection
};