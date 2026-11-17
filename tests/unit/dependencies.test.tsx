import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { motion, MotionConfig } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { z } from 'zod';
test('Motion and Lucide render with reduced motion', () => {
  render(
    <MotionConfig reducedMotion="always">
      <motion.div initial={false}>
        <Sparkles aria-label="Effects available" />
      </motion.div>
    </MotionConfig>,
  );
  expect(screen.getByLabelText('Effects available')).toBeInTheDocument();
});
test('request validation rejects malformed input', () => {
  const schema = z.object({ id: z.uuid() });
  expect(schema.safeParse({ id: 'invalid' }).success).toBe(false);
});
