const CAR_PARTS = {
  front: [
    {
      id: 1,
      name: "front wing 1",
      mass: 11.2,
      cd: 0.170,
      image: "/assets/parts/front/front1.png"
    },
    {
      id: 2,
      name: "front wing 2",
      mass: 12.4,
      cd: 0.160,
      image: "/assets/parts/front/front2.png"
    },
    {
      id: 3,
      name: "front wing 3",
      mass: 13.7,
      cd: 0.165,
      image: "/assets/parts/front/front3.png"
    },
    {
      id: 4,
      name: "front wing 4",
      mass: 14.9,
      cd: 0.154,
      image: "/assets/parts/front/front4.png"
    }
  ],

  body: [
    {
      id: 1,
      name: "body 1",
      mass: 18.1,
      cd: 0.205,
      image: "/assets/parts/body/body1.png"
    },
    {
      id: 2,
      name: "body 2",
      mass: 16.4,
      cd: 0.194,
      image: "/assets/parts/body/body2.png"
    },
    {
      id: 3,
      name: "body 3",
      mass: 19.0,
      cd: 0.199,
      image: "/assets/parts/body/body3.png"
    },
    {
      id: 4,
      name: "body 4",
      mass: 17.2,
      cd: 0.186,
      image: "/assets/parts/body/body4.png"
    }
  ],

  rear: [
    {
      id: 1,
      name: "rear wing 1",
      mass: 21.0,
      cd: 0.152,
      image: "/assets/parts/rear/rear1.png"
    },
    {
      id: 2,
      name: "rear wing 2",
      mass: 22.3,
      cd: 0.143,
      image: "/assets/parts/rear/rear2.png"
    },
    {
      id: 3,
      name: "rear wing 3",
      mass: 20.9,
      cd: 0.148,
      image: "/assets/parts/rear/rear3.png"
    },
    {
      id: 4,
      name: "rear wing 4",
      mass: 21.7,
      cd: 0.138,
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

  const totalMass = Number((front.mass + body.mass + rear.mass).toFixed(1));
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