export type NnGlossaryTerm =
  | 'hiddenNeurons'
  | 'hiddenLayer'
  | 'learningRate'
  | 'dataset'
  | 'xor'
  | 'and'
  | 'custom'
  | 'input'
  | 'target'
  | 'output'
  | 'epoch'
  | 'loss'
  | 'weights'
  | 'bias'
  | 'activation'
  | 'sigmoid'
  | 'linear'
  | 'forwardPass'
  | 'training'
  | 'probe';

export interface NnGlossaryEntry {
  label: string;
  explanation: string;
}

export const NN_GLOSSARY: Record<NnGlossaryTerm, NnGlossaryEntry> = {
  hiddenNeurons: {
    label: 'Hidden neurons',
    explanation:
      'Neurons in the middle layer between input and output. More neurons give the network more capacity to learn curved boundaries like XOR.',
  },
  hiddenLayer: {
    label: 'Hidden layer',
    explanation:
      'The layer between inputs and the final output. Non-linear activations here let the network combine inputs in ways a single layer cannot.',
  },
  learningRate: {
    label: 'Learning rate',
    explanation:
      'How large each weight update step is during training. Too high oscillates or diverges; too low learns very slowly.',
  },
  dataset: {
    label: 'Dataset',
    explanation:
      'The collection of input–target pairs the network trains on. Each row teaches what output should appear for a given input.',
  },
  xor: {
    label: 'XOR',
    explanation:
      'Exclusive OR: output is 1 when inputs differ, 0 when they match. Not linearly separable — a classic demo that needs a hidden layer.',
  },
  and: {
    label: 'AND',
    explanation:
      'Logical AND: output is 1 only when both inputs are 1. Linearly separable, so it is easier to learn than XOR.',
  },
  custom: {
    label: 'Custom',
    explanation:
      'Your own training rows with separate input and target fields. Use any finite numbers — not limited to 0 and 1.',
  },
  input: {
    label: 'Input',
    explanation:
      'The values fed into the network (here x1 and x2). The network has no labels built in — it only sees these numbers.',
  },
  target: {
    label: 'Target',
    explanation:
      'The desired output (y) for a row. Training nudges weights so predictions move toward these targets.',
  },
  output: {
    label: 'Output',
    explanation:
      'What the network predicts after a forward pass. Compared to the target to compute error and update weights.',
  },
  epoch: {
    label: 'Epoch',
    explanation:
      'One pass through every training sample, updating weights once per row. Many epochs are usually needed for hard problems.',
  },
  loss: {
    label: 'Loss',
    explanation:
      'Average squared error between predictions and targets. Lower loss means the network fits the data better.',
  },
  weights: {
    label: 'Weights',
    explanation:
      'Strength of each input connection into a neuron. Training adjusts weights to reduce error on the dataset.',
  },
  bias: {
    label: 'Bias',
    explanation:
      'An extra constant added inside each neuron before activation. Lets the decision boundary shift without changing inputs.',
  },
  activation: {
    label: 'Activation',
    explanation:
      'A non-linear function applied after weights · input + bias. Without it, stacking layers would still behave like one linear map.',
  },
  sigmoid: {
    label: 'Sigmoid',
    explanation:
      'Squashes values into (0, 1), good for binary-style targets. Cannot reach outputs outside that range.',
  },
  linear: {
    label: 'Linear',
    explanation:
      'Identity output (no squashing). Use when targets can be any real number, such as regression to 2 or −0.5.',
  },
  forwardPass: {
    label: 'Forward pass',
    explanation:
      'Run input through the network once to get a prediction. No weight updates — used by the probe section.',
  },
  training: {
    label: 'Training',
    explanation:
      'Repeated forward passes plus backpropagation that adjusts weights to reduce loss on the dataset.',
  },
  probe: {
    label: 'Probe',
    explanation:
      'Try a single input through the current weights without adding it to training data or changing the network.',
  },
};
