import React from 'react';

interface CustomButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

const CustomButton: React.FC<CustomButtonProps> = ({
  children,
  variant = 'primary',
  ...props
}) => {
  const getButtonClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'secondary':
        return 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      case 'ghost':
        return 'text-gray-400 hover:text-gray-300';
      default:
        return '';
    }
  };

  return (
    <button
      className={`px-4 py-2 rounded-md transition-colors duration-300 ${getButtonClasses()}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default CustomButton;
