/**
 * Web replacements for the react-native primitives this app used.
 *
 * Each component renders the same DOM element react-native-web rendered, with the same
 * default styles (see the `.rnw-*` classes in src/global.css). That keeps the ported
 * screens' existing Tailwind classes — which were written against RN's column-by-default
 * flex model — laying out exactly as they did on the Expo web build.
 */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type UIEvent,
} from 'react';
import { createPortal } from 'react-dom';

import { cx, flattenStyle, type RNStyle } from './style';

export { StyleSheet, flattenStyle, cx } from './style';
export type { RNStyle } from './style';
export type StyleProp<_T> = RNStyle;
export type ViewStyle = CSSProperties;
export type TextStyle = CSSProperties;
export type ImageStyle = CSSProperties;
export type ColorValue = string;

/**
 * Scroll/layout event shapes. Screens destructure `event.nativeEvent.contentOffset.y`,
 * so the nested shape is preserved rather than swapped for a raw DOM event.
 */
export interface NativeScrollEvent {
  contentOffset: { x: number; y: number };
  contentSize: { width: number; height: number };
  layoutMeasurement: { width: number; height: number };
}

export interface NativeSyntheticEvent<T> {
  nativeEvent: T;
}

export interface LayoutChangeEvent {
  nativeEvent: { layout: { x: number; y: number; width: number; height: number } };
}

/* ------------------------------------------------------------------ View */

export interface ViewProps {
  children?: ReactNode;
  className?: string;
  style?: RNStyle;
  id?: string;
  testID?: string;
  accessibilityLabel?: string;
  role?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
}

/**
 * RN's `onLayout` fires on mount and on every size change; ResizeObserver is the web
 * equivalent. HeroBanner depends on this to size its carousel slides.
 */
function useOnLayout(
  onLayout: ((event: LayoutChangeEvent) => void) | undefined,
  node: HTMLElement | null
) {
  const callbackRef = useRef(onLayout);
  callbackRef.current = onLayout;

  useEffect(() => {
    if (!onLayout || !node) return;

    const emit = () => {
      const rect = node.getBoundingClientRect();
      callbackRef.current?.({
        nativeEvent: {
          layout: { x: node.offsetLeft, y: node.offsetTop, width: rect.width, height: rect.height },
        },
      });
    };

    emit();
    const observer = new ResizeObserver(emit);
    observer.observe(node);
    return () => observer.disconnect();
    // `onLayout` is read through a ref so a new inline callback doesn't re-observe.
  }, [Boolean(onLayout), node]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const View = forwardRef<HTMLDivElement, ViewProps>(function View(
  { children, className, style, testID, accessibilityLabel, pointerEvents, role, onLayout, ...rest },
  ref
) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useOnLayout(onLayout, node);

  const setRefs = useCallback(
    (element: HTMLDivElement | null) => {
      setNode(element);
      if (typeof ref === 'function') ref(element);
      else if (ref) (ref as { current: HTMLDivElement | null }).current = element;
    },
    [ref]
  );

  return (
    <div
      ref={onLayout ? setRefs : ref}
      className={cx('rnw-view', className)}
      style={{
        ...flattenStyle(style),
        ...(pointerEvents === 'none' ? { pointerEvents: 'none' as const } : null),
      }}
      data-testid={testID}
      aria-label={accessibilityLabel}
      role={role}
      {...rest}
    >
      {children}
    </div>
  );
});

/* ------------------------------------------------------------------ Text */

/** react-native-web renders nested <Text> as <span> inheriting font/colour; top level as <div>. */
const TextAncestorContext = createContext(false);

export interface TextProps {
  children?: ReactNode;
  className?: string;
  style?: RNStyle;
  numberOfLines?: number;
  onPress?: (event: React.MouseEvent) => void;
  accessibilityLabel?: string;
  selectable?: boolean;
  testID?: string;
}

export function Text({
  children,
  className,
  style,
  numberOfLines,
  onPress,
  accessibilityLabel,
  testID,
}: TextProps) {
  const hasTextAncestor = useContext(TextAncestorContext);

  const lineClamp =
    numberOfLines != null && numberOfLines > 1 ? { WebkitLineClamp: numberOfLines } : null;

  const element = hasTextAncestor ? (
    <span
      className={cx(
        'rnw-text-nested',
        numberOfLines === 1 && 'rnw-text-one-line',
        numberOfLines != null && numberOfLines > 1 && 'rnw-text-multi-line',
        onPress && 'rnw-pressable',
        className
      )}
      style={{ ...lineClamp, ...flattenStyle(style) }}
      onClick={onPress}
      aria-label={accessibilityLabel}
      data-testid={testID}
    >
      {children}
    </span>
  ) : (
    <div
      dir="auto"
      className={cx(
        'rnw-text',
        numberOfLines === 1 && 'rnw-text-one-line',
        numberOfLines != null && numberOfLines > 1 && 'rnw-text-multi-line',
        onPress && 'rnw-pressable',
        className
      )}
      style={{ ...lineClamp, ...flattenStyle(style) }}
      onClick={onPress}
      aria-label={accessibilityLabel}
      data-testid={testID}
    >
      {children}
    </div>
  );

  if (hasTextAncestor) return element;
  return <TextAncestorContext.Provider value>{element}</TextAncestorContext.Provider>;
}

/* ------------------------------------------------------------------ Pressable */

export interface PressableProps {
  children?: ReactNode | ((state: { pressed: boolean; hovered: boolean }) => ReactNode);
  className?: string;
  style?: RNStyle | ((state: { pressed: boolean }) => RNStyle);
  onPress?: (event: React.MouseEvent) => void;
  onLongPress?: (event: React.MouseEvent) => void;
  disabled?: boolean;
  /** RN expands the touch target; on the web the equivalent is negative margin + padding. */
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityLabel?: string;
  /** 토글형 버튼(필터 칩 등)의 눌림 상태. RN 의 `accessibilityState={{ selected }}` 대역 — `aria-pressed` 로 노출한다. */
  pressed?: boolean;
  testID?: string;
}

function hitSlopStyle(hitSlop: PressableProps['hitSlop']): CSSProperties {
  if (hitSlop == null) return {};
  const box =
    typeof hitSlop === 'number'
      ? { top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }
      : { top: 0, bottom: 0, left: 0, right: 0, ...hitSlop };

  return {
    paddingTop: box.top,
    paddingBottom: box.bottom,
    paddingLeft: box.left,
    paddingRight: box.right,
    marginTop: -box.top,
    marginBottom: -box.bottom,
    marginLeft: -box.left,
    marginRight: -box.right,
  };
}

export function Pressable({
  children,
  className,
  style,
  onPress,
  onLongPress,
  disabled,
  hitSlop,
  accessibilityLabel,
  pressed: pressedState,
  testID,
}: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;

  const handleClick = (event: React.MouseEvent) => {
    if (disabled) return;
    onPress?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPress?.(event as unknown as React.MouseEvent);
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-pressed={pressedState}
      aria-label={accessibilityLabel}
      data-testid={testID}
      className={cx('rnw-view', !disabled && 'rnw-pressable', className)}
      style={{ ...hitSlopStyle(hitSlop), ...flattenStyle(resolvedStyle) }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onLongPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
    >
      {typeof children === 'function' ? children({ pressed, hovered }) : children}
    </div>
  );
}

export const TouchableOpacity = Pressable;

/* ------------------------------------------------------------------ ScrollView */

export interface ScrollViewProps {
  children?: ReactNode;
  className?: string;
  style?: RNStyle;
  contentContainerClassName?: string;
  contentContainerStyle?: RNStyle;
  horizontal?: boolean;
  pagingEnabled?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Browsers have no momentum-scroll end event; approximated by a debounced scroll idle. */
  onMomentumScrollEnd?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  ref?: Ref<HTMLDivElement>;
}

const MOMENTUM_IDLE_MS = 120;

function toScrollEvent(target: HTMLDivElement): NativeSyntheticEvent<NativeScrollEvent> {
  return {
    nativeEvent: {
      contentOffset: { x: target.scrollLeft, y: target.scrollTop },
      contentSize: { width: target.scrollWidth, height: target.scrollHeight },
      layoutMeasurement: { width: target.clientWidth, height: target.clientHeight },
    },
  };
}

export const ScrollView = forwardRef<HTMLDivElement, ScrollViewProps>(function ScrollView(
  {
    children,
    className,
    style,
    contentContainerClassName,
    contentContainerStyle,
    horizontal,
    pagingEnabled,
    showsVerticalScrollIndicator,
    showsHorizontalScrollIndicator,
    onScroll,
    onMomentumScrollEnd,
  },
  ref
) {
  const hideIndicator = horizontal
    ? showsHorizontalScrollIndicator === false
    : showsVerticalScrollIndicator === false;

  const momentumTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll =
    onScroll || onMomentumScrollEnd
      ? (event: UIEvent<HTMLDivElement>) => {
          const target = event.currentTarget;
          onScroll?.(toScrollEvent(target));

          if (onMomentumScrollEnd) {
            if (momentumTimer.current) clearTimeout(momentumTimer.current);
            momentumTimer.current = setTimeout(
              () => onMomentumScrollEnd(toScrollEvent(target)),
              MOMENTUM_IDLE_MS
            );
          }
        }
      : undefined;

  return (
    <div
      ref={ref}
      className={cx(
        'rnw-view rnw-scroll-view',
        horizontal ? 'rnw-scroll-horizontal' : 'rnw-scroll-vertical',
        hideIndicator && 'rnw-scroll-hide-indicator',
        className
      )}
      style={{
        ...(pagingEnabled
          ? { scrollSnapType: horizontal ? ('x mandatory' as const) : ('y mandatory' as const) }
          : null),
        ...flattenStyle(style),
      }}
      onScroll={handleScroll}
    >
      <div
        className={cx(
          'rnw-view',
          // RN lays a horizontal ScrollView's content container out in a row.
          horizontal && 'flex-row',
          contentContainerClassName
        )}
        style={{
          ...(horizontal ? null : { flexShrink: undefined }),
          ...flattenStyle(contentContainerStyle),
        }}
      >
        {children}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ FlatList */

export interface FlatListProps<T> {
  data: readonly T[] | null | undefined;
  renderItem: (info: { item: T; index: number }) => ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  ListEmptyComponent?: ReactNode;
  ItemSeparatorComponent?: () => ReactNode;
  className?: string;
  style?: RNStyle;
  contentContainerClassName?: string;
  contentContainerStyle?: RNStyle;
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  onScroll?: ScrollViewProps['onScroll'];
  scrollEventThrottle?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  numColumns?: number;
  extraData?: unknown;
}

export function FlatList<T>({
  data,
  renderItem,
  keyExtractor,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  ItemSeparatorComponent,
  ...scrollProps
}: FlatListProps<T>) {
  const items = data ?? [];

  return (
    <ScrollView {...scrollProps}>
      {ListHeaderComponent}
      {items.length === 0
        ? ListEmptyComponent
        : items.map((item, index) => (
            <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>
              {renderItem({ item, index })}
              {ItemSeparatorComponent && index < items.length - 1 ? ItemSeparatorComponent() : null}
            </View>
          ))}
      {ListFooterComponent}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ TextInput */

export interface TextInputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  placeholderTextColor?: string;
  className?: string;
  style?: RNStyle;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  returnKeyType?: string;
  textAlignVertical?: 'top' | 'center' | 'bottom';
  maxLength?: number;
}

const KEYBOARD_TO_INPUT_TYPE: Record<string, string> = {
  numeric: 'number',
  'number-pad': 'number',
  'email-address': 'email',
  'phone-pad': 'tel',
  default: 'text',
};

/** Screens do `useRef<TextInput>(null)` to call `.focus()`; keep that type name working. */
export type TextInput = HTMLInputElement | HTMLTextAreaElement;

export const TextInput = forwardRef<HTMLInputElement | HTMLTextAreaElement, TextInputProps>(
  function TextInput(
    {
      value,
      onChangeText,
      onSubmitEditing,
      placeholder,
      placeholderTextColor,
      className,
      style,
      multiline,
      numberOfLines,
      secureTextEntry,
      keyboardType,
      autoCapitalize,
      autoFocus,
      editable,
      maxLength,
    },
    ref
  ) {
    const shared = {
      value: value ?? '',
      placeholder,
      autoFocus,
      maxLength,
      disabled: editable === false,
      autoCapitalize,
      className: cx('rnw-text-input', className),
      style: {
        // RN renders placeholder colour via a prop; the web equivalent is a CSS variable
        // consumed by the ::placeholder rule below.
        ...(placeholderTextColor ? { ['--placeholder-color' as string]: placeholderTextColor } : null),
        ...flattenStyle(style),
      } as CSSProperties,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        onChangeText?.(event.target.value),
    };

    if (multiline) {
      return (
        <textarea
          {...shared}
          ref={ref as Ref<HTMLTextAreaElement>}
          rows={numberOfLines}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSubmitEditing?.();
          }}
        />
      );
    }

    return (
      <input
        {...shared}
        ref={ref as Ref<HTMLInputElement>}
        type={secureTextEntry ? 'password' : KEYBOARD_TO_INPUT_TYPE[keyboardType ?? 'default']}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmitEditing?.();
        }}
      />
    );
  }
);

/* ------------------------------------------------------------------ Modal */

export interface ModalProps {
  visible?: boolean;
  children?: ReactNode;
  animationType?: 'none' | 'slide' | 'fade';
  transparent?: boolean;
  onRequestClose?: () => void;
}

export function Modal({ visible, children, transparent, onRequestClose }: ModalProps) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose]);

  if (!visible) return null;

  return createPortal(
    <div
      className="rnw-view"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: transparent ? 'transparent' : '#ffffff',
      }}
    >
      {children}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ Image */

export interface ImageProps {
  source?: { uri: string } | string;
  uri?: string;
  alt?: string;
  accessibilityLabel?: string;
  className?: string;
  style?: RNStyle;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none';
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  onLoad?: () => void;
  onError?: () => void;
}

export function Image({
  source,
  alt,
  accessibilityLabel,
  className,
  style,
  contentFit,
  resizeMode,
  onLoad,
  onError,
}: ImageProps) {
  const uri = typeof source === 'string' ? source : source?.uri;
  const fit: CSSProperties['objectFit'] =
    contentFit ??
    (resizeMode === 'stretch' ? 'fill' : resizeMode === 'center' ? 'none' : resizeMode) ??
    'cover';

  return (
    <img
      src={uri}
      alt={alt ?? accessibilityLabel ?? ''}
      className={className}
      style={{ objectFit: fit, ...flattenStyle(style) }}
      onLoad={onLoad}
      onError={onError}
      draggable={false}
    />
  );
}

/* ------------------------------------------------------------------ ActivityIndicator */

export function ActivityIndicator({
  size = 'small',
  color = '#17847a',
  className,
  style,
}: {
  size?: 'small' | 'large' | number;
  color?: string;
  className?: string;
  style?: RNStyle;
}) {
  const px = typeof size === 'number' ? size : size === 'large' ? 36 : 20;

  return (
    <div
      className={cx('rnw-view', className)}
      style={{ width: px, height: px, ...flattenStyle(style) }}
      role="progressbar"
    >
      <svg width={px} height={px} viewBox="0 0 50 50" style={{ animation: 'rnw-spin 1s linear infinite' }}>
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="90 150"
        />
      </svg>
      <style>{`@keyframes rnw-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ SafeAreaView */

export interface SafeAreaViewProps extends ViewProps {
  /** Native inset edges. The browser has no unsafe areas, so this is accepted and ignored. */
  edges?: readonly ('top' | 'bottom' | 'left' | 'right')[];
}

export function SafeAreaView({ edges: _edges, ...props }: SafeAreaViewProps) {
  return <View {...props} />;
}

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

/* ------------------------------------------------------------------ Platform / Dimensions */

export const Platform = {
  OS: 'web' as const,
  select: <T,>(spec: { web?: T; native?: T; default?: T; ios?: T; android?: T }): T | undefined =>
    'web' in spec ? spec.web : spec.default,
};

export function useWindowDimensions() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

export const Dimensions = {
  get: (_dim: 'window' | 'screen') => ({
    width: typeof window === 'undefined' ? 1280 : window.innerWidth,
    height: typeof window === 'undefined' ? 800 : window.innerHeight,
  }),
};

/* ------------------------------------------------------------------ misc */

export function useIsMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}
