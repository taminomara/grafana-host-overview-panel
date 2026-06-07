import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CellSizeInput } from './CellSizeEditor';
import { CellSize } from '../../types';

function setup(initial: CellSize, allowFit = false) {
  const onChange = jest.fn();
  render(<CellSizeInput value={initial} onChange={onChange} allowFit={allowFit} />);
  return { onChange };
}

describe('CellSizeInput', () => {
  it('free + width change → emits only width changed', () => {
    const { onChange } = setup({ width: 20, height: 30, mode: 'free' });

    fireEvent.change(screen.getByLabelText('Cell width'), { target: { value: '50' } });

    expect(onChange).toHaveBeenCalledWith({ width: 50, height: 30, mode: 'free' });
  });

  it('free + height change → emits only height changed', () => {
    const { onChange } = setup({ width: 20, height: 30, mode: 'free' });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '40' } });

    expect(onChange).toHaveBeenCalledWith({ width: 20, height: 40, mode: 'free' });
  });

  it('locked + height change → emits width and height equal to new value', () => {
    const { onChange } = setup({ width: 99, height: 20, mode: 'locked' });

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '35' } });

    expect(onChange).toHaveBeenCalledWith({ width: 35, height: 35, mode: 'locked' });
  });

  it('locked: width input is disabled and shows the height value', () => {
    const onChange = jest.fn();
    render(
      <CellSizeInput
        value={{ width: 99, height: 27, mode: 'locked' }}
        onChange={onChange}
        allowFit={false}
      />
    );

    const widthInput = screen.getByLabelText('Cell width') as HTMLInputElement;
    expect(widthInput).toBeDisabled();
    expect(widthInput.value).toBe('27');
  });

  it('fit: width input is disabled and shows the literal "auto"', () => {
    const onChange = jest.fn();
    render(
      <CellSizeInput
        value={{ width: 99, height: 18, mode: 'fit' }}
        onChange={onChange}
        allowFit={true}
      />
    );

    const widthInput = screen.getByLabelText('Cell width') as HTMLInputElement;
    expect(widthInput).toBeDisabled();
    expect(widthInput.value).toBe('auto');
  });

  it('fit + height change → emits new height, mode stays fit', () => {
    const { onChange } = setup({ width: 99, height: 18, mode: 'fit' }, true);

    fireEvent.change(screen.getByLabelText('Cell height'), { target: { value: '24' } });

    expect(onChange).toHaveBeenCalledWith({ width: 99, height: 24, mode: 'fit' });
  });

  it('cycle from free (allowFit false) → snaps width to height and sets mode locked', () => {
    const { onChange } = setup({ width: 20, height: 40, mode: 'free' });

    fireEvent.click(
      screen.getByLabelText('Width and height are independent. Click to lock cell width to height.')
    );

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'locked' });
  });

  it('cycle from locked (allowFit true) → sets mode fit, width and height unchanged', () => {
    const { onChange } = setup({ width: 40, height: 40, mode: 'locked' }, true);

    fireEvent.click(
      screen.getByLabelText('Width is locked to height. Click to fit cell width to text.')
    );

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'fit' });
  });

  it('cycle from locked (allowFit false) → sets mode free, width and height unchanged', () => {
    const { onChange } = setup({ width: 40, height: 40, mode: 'locked' }, false);

    fireEvent.click(
      screen.getByLabelText(
        'Width is locked to height. Click to allow different width and height.'
      )
    );

    expect(onChange).toHaveBeenCalledWith({ width: 40, height: 40, mode: 'free' });
  });

  it('cycle from fit → sets mode free, width and height unchanged', () => {
    const { onChange } = setup({ width: 99, height: 18, mode: 'fit' }, true);

    fireEvent.click(
      screen.getByLabelText(
        'Width is fitted to cell text. Click to allow different width and height.'
      )
    );

    expect(onChange).toHaveBeenCalledWith({ width: 99, height: 18, mode: 'free' });
  });
});
