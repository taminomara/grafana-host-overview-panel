import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CellSizeInput } from './CellSizeEditor';
import { CellSize } from '../../types';

function setup(initial: CellSize) {
  const onChange = jest.fn();
  render(<CellSizeInput value={initial} onChange={onChange} />);
  return { onChange };
}

describe('CellSizeInput', () => {
  it('locked + width change → emits both width and height equal to new value', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: true });

    fireEvent.change(screen.getByLabelText('Cell width'), { target: { value: '35' } });

    expect(onChange).toHaveBeenCalledWith({ width: 35, height: 35, locked: true });
  });

  it('unlocked + height change → emits only height changed', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: false });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 40, locked: false });
  });

  it('lock engage → snaps height to width and sets locked true', () => {
    const { onChange } = setup({ width: 20, height: 40, locked: false });

    fireEvent.click(screen.getByLabelText('Keep width and height equal'));

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 20, locked: true });
  });

  it('lock release → sets locked false, width and height unchanged', () => {
    const { onChange } = setup({ width: 20, height: 20, locked: true });

    fireEvent.click(screen.getByLabelText('Allow different width and height'));

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 20, locked: false });
  });

  it('disables the height input when locked and shows width value', () => {
    const onChange = jest.fn();
    render(<CellSizeInput value={{ width: 27, height: 99, locked: true }} onChange={onChange} />);

    const heightInput = screen.getByLabelText('Cell height') as HTMLInputElement;
    expect(heightInput).toBeDisabled();
    expect(heightInput.value).toBe('27');
  });
});
