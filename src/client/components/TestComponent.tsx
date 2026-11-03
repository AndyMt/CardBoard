import React from 'react';

export interface TestComponentProps {
  title: string;
  description?: string;
}

export const TestComponent: React.FC<TestComponentProps> = ({ title, description }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md m-2">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {description && <p className="text-gray-600">{description}</p>}
    </div>
  );
};

export default TestComponent;